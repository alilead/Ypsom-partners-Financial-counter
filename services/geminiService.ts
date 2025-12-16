import { GoogleGenAI, Type, Schema } from "@google/genai";
import { DocumentType, FinancialData } from "../types";

// Initialize Gemini Client
// Note: In a real app, ensure process.env.API_KEY is handled securely.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Helper to convert Blob/File to Base64
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Analyzes a financial document using Gemini 3.0 Pro.
 * Includes a timeout to prevent infinite loading states.
 */
export const analyzeFinancialDocument = async (file: File): Promise<FinancialData> => {
  const base64Data = await fileToBase64(file);
  const mimeType = file.type;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      documentType: {
        type: Type.STRING,
        enum: [
          DocumentType.BANK_STATEMENT,
          DocumentType.INVOICE,
          DocumentType.RECEIPT,
          DocumentType.UNKNOWN
        ],
        description: "The type of the document."
      },
      date: { type: Type.STRING, description: "Document date in YYYY-MM-DD format. Return 'Not found' if missing." },
      issuer: { type: Type.STRING, description: "Name of the bank or vendor. Return 'Not found' if missing." },
      documentNumber: { type: Type.STRING, description: "Invoice or receipt number. Return 'Not found' if missing." },
      totalAmount: { type: Type.NUMBER, description: "Total transaction amount." },
      originalCurrency: { type: Type.STRING, description: "3-letter currency code (e.g., USD, EUR, CHF)." },
      vatAmount: { type: Type.NUMBER, description: "VAT amount. Return 0 if not found/applicable." },
      netAmount: { type: Type.NUMBER, description: "Net amount excluding VAT." },
      expenseCategory: { type: Type.STRING, description: "Category: Travel, Meals, Utilities, Software, Professional Services, etc." },
      amountInCHF: { type: Type.NUMBER, description: "Total amount converted to Swiss Francs (CHF)." },
      conversionRateUsed: { type: Type.NUMBER, description: "The exchange rate used for conversion to CHF (1 Original = X CHF)." },
      notes: { type: Type.STRING, description: "Any observation or reason for 'Not found' values." }
    },
    required: ["documentType", "totalAmount", "originalCurrency", "amountInCHF", "expenseCategory", "issuer"]
  };

  try {
    // 60 second timeout protection
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Analysis timed out after 60 seconds")), 60000);
    });

    const apiCall = ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          {
            text: `Analyze this financial document. 
            1. Identify if it is a Bank Statement, Invoice, or Receipt.
            2. Extract key details: Date, Issuer, Doc Number, Amounts (Total, Net, VAT).
            3. Categorize the expense based on the items or issuer.
            4. Detect the currency. If it is NOT CHF, convert the Total Amount to CHF using the current or historical exchange rate based on the document date.
            5. Ensure data consistency. Do not infer missing values, mark as 'Not found' (or 0 for numbers) if unclear.
            
            Return ONLY the result in JSON format matching the schema.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    });

    // Race the API call against the timeout
    const response: any = await Promise.race([apiCall, timeoutPromise]);

    if (response.text) {
      let cleanText = response.text.trim();
      // Handle markdown code blocks
      if (cleanText.includes("```json")) {
         cleanText = cleanText.split("```json")[1].split("```")[0].trim();
      } else if (cleanText.includes("```")) {
         cleanText = cleanText.split("```")[1].split("```")[0].trim();
      }
      
      try {
        return JSON.parse(cleanText) as FinancialData;
      } catch (e) {
        console.error("JSON Parse Error:", e);
        console.log("Raw text:", response.text);
        throw new Error("Failed to parse analysis results.");
      }
    } else {
      throw new Error("No response text received from Gemini.");
    }
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

/**
 * Generates an executive summary based on processed financial data.
 */
export const generateFinancialSummary = async (data: FinancialData[]): Promise<string> => {
  if (data.length === 0) return "No data available to summarize.";

  // Prepare a concise text representation of the data for the prompt
  const dataSummary = data.map(d => 
    `- ${d.date}: ${d.issuer} (${d.expenseCategory}) - ${d.amountInCHF.toFixed(2)} CHF`
  ).join('\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `You are a financial controller at Ypsom Partners. Write a concise executive summary (approx. 3-4 sentences) based on the following processed transactions. 
      Focus on the total volume, the largest spending categories/issuers, and any notable trends. Use a professional tone.
      
      Transaction Data:
      ${dataSummary}`
    });

    return response.text || "Could not generate summary.";
  } catch (error) {
    console.error("Summary Generation Error:", error);
    return "Failed to generate summary due to an error.";
  }
};

/**
 * Edits an image using Gemini 2.5 Flash Image.
 */
export const editImageWithGemini = async (file: File, prompt: string): Promise<string> => {
  const base64Data = await fileToBase64(file);
  const mimeType = file.type;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          {
            text: prompt
          }
        ]
      }
    });

    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const parts = candidates[0].content.parts;
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("No edited image generated.");
  } catch (error) {
    console.error("Gemini Image Edit Error:", error);
    throw error;
  }
};
