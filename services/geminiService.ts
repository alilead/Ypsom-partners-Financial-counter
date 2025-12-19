import { GoogleGenAI, Type, Schema } from "@google/genai";
import { DocumentType, FinancialData, BankStatementAnalysis, BankTransaction } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Helper to convert Blob/File to Base64
 */
export const fileToBase64 = (file: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Analyzes a financial document with attention to handwritten references
 */
export const analyzeFinancialDocument = async (file: File): Promise<FinancialData> => {
  const base64 = await fileToBase64(file);
  const mimeType = file.type;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      documentType: {
        type: Type.STRING,
        enum: [
          DocumentType.INVOICE,
          DocumentType.RECEIPT,
          DocumentType.BANK_STATEMENT,
          DocumentType.UNKNOWN
        ]
      },
      date: { type: Type.STRING },
      issuer: { type: Type.STRING },
      documentNumber: { type: Type.STRING },
      totalAmount: { type: Type.NUMBER },
      originalCurrency: { type: Type.STRING },
      vatAmount: { type: Type.NUMBER },
      netAmount: { type: Type.NUMBER },
      expenseCategory: { type: Type.STRING },
      amountInCHF: { type: Type.NUMBER },
      conversionRateUsed: { type: Type.NUMBER },
      notes: { type: Type.STRING },
      handwrittenRef: { type: Type.STRING, description: "Any handwritten reference like (1), (2) or P.1-(1) found in corners." },
      lineItems: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            description: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            type: { type: Type.STRING, enum: ["INCOME", "EXPENSE"] },
            category: { type: Type.STRING },
            supportingDocRef: { type: Type.STRING, description: "The handwritten reference number next to the line item if bank statement." }
          },
          required: ["date", "description", "amount", "type"]
        }
      }
    },
    required: ["documentType", "totalAmount", "originalCurrency", "amountInCHF", "expenseCategory", "issuer"]
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64 } },
          {
            text: `Analyze this document. 
            IMPORTANT: Look for handwritten annotations like circled numbers (1), (2), (3) or text like 'P.1-(1)'. 
            If found on a Receipt/Invoice, store in 'handwrittenRef'.
            If found next to a line on a Bank Statement, store in 'supportingDocRef'.
            
            Extract ALL transaction lines for bank statements. Classify as INCOME or EXPENSE.
            Return JSON.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    });

    if (response.text) {
      let cleanText = response.text.trim();
      if (cleanText.includes("```json")) cleanText = cleanText.split("```json")[1].split("```")[0].trim();
      else if (cleanText.includes("```")) cleanText = cleanText.split("```")[1].split("```")[0].trim();
      return JSON.parse(cleanText) as FinancialData;
    }
    throw new Error("Empty response");
  } catch (error) {
    console.error("Document Analysis Error:", error);
    throw error;
  }
};

/**
 * Batch reconciliation of statement transactions to support documents
 */
export const reconcileDocuments = (docs: FinancialData[]): FinancialData[] => {
  const supports = docs.filter(d => d.documentType !== DocumentType.BANK_STATEMENT);

  return docs.map(doc => {
    if (doc.documentType === DocumentType.BANK_STATEMENT && doc.lineItems) {
      const reconciledLines = doc.lineItems.map(line => {
        // Match by Handwritten Ref
        let match = supports.find(s => 
          s.handwrittenRef && line.supportingDocRef && (
            s.handwrittenRef.includes(line.supportingDocRef) ||
            line.supportingDocRef.includes(s.handwrittenRef)
          )
        );

        // Fallback to Amount Match
        if (!match) {
          match = supports.find(s => Math.abs(s.totalAmount - line.amount) < 0.01);
        }

        if (match) {
          return {
            ...line,
            category: match.expenseCategory,
            notes: `Linked: ${match.issuer} (${match.handwrittenRef || 'Auto-match'})`
          };
        }
        return line;
      });

      return { ...doc, lineItems: reconciledLines };
    }
    return doc;
  });
};

/**
 * Summarize Financial Data
 */
export const generateFinancialSummary = async (data: FinancialData[]): Promise<string> => {
  if (data.length === 0) return "No data.";
  const summaryBlob = data.map(d => `${d.documentType}: ${d.issuer} - ${d.amountInCHF.toFixed(2)} CHF`).join('\n');
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Perform a financial audit summary of these documents. Mention specifically if statements match invoices. Data:\n${summaryBlob}`
    });
    return response.text || "Summary unavailable.";
  } catch (error) {
    return "Summary failed.";
  }
};

/** Legacy compatibility */
export const analyzeBankStatement = async (f: File) => {
  const d = await analyzeFinancialDocument(f);
  return {
    accountHolder: d.issuer, period: d.date, currency: d.originalCurrency,
    transactions: d.lineItems || [],
    calculatedTotalIncome: d.lineItems?.filter(i => i.type === 'INCOME').reduce((s,i) => s+i.amount, 0),
    calculatedTotalExpense: d.lineItems?.filter(i => i.type === 'EXPENSE').reduce((s,i) => s+i.amount, 0)
  };
};

/** Image Edit */
export const editImageWithGemini = async (file: File, prompt: string): Promise<string> => {
  const base64Data = await fileToBase64(file);
  const mimeType = file.type;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { mimeType, data: base64Data } },
        { text: prompt }
      ]
    }
  });
  const parts = response.candidates?.[0]?.content?.parts;
  if (parts) {
    for (const p of parts) {
      if (p.inlineData) return `data:image/png;base64,${p.inlineData.data}`;
    }
  }
  throw new Error("No image returned");
};
