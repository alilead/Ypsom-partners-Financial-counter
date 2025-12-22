
import { GoogleGenAI, Type } from "@google/genai";
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
 * Analyzes a financial document with deep focus on precision for Swiss receipts and handwritten notes.
 * Now handles target currency conversion dynamically.
 */
export const analyzeFinancialDocument = async (file: File, targetCurrency: string = 'CHF'): Promise<FinancialData> => {
  const base64 = await fileToBase64(file);
  const mimeType = file.type;

  const schema = {
    type: Type.OBJECT,
    properties: {
      documentType: {
        type: Type.STRING,
        enum: [
          DocumentType.INVOICE,
          DocumentType.RECEIPT,
          DocumentType.BANK_STATEMENT,
          DocumentType.UNKNOWN
        ],
        description: "Classification: Receipt (thermal/small), Invoice (A4/Detailed), or Bank Statement."
      },
      date: { type: Type.STRING, description: "The date of the document (YYYY-MM-DD)." },
      issuer: { type: Type.STRING, description: "The merchant, bank, or company name." },
      documentNumber: { type: Type.STRING, description: "Invoice number, receipt ID, or account number." },
      totalAmount: { type: Type.NUMBER, description: "The final total amount in original currency (Gross / TTC)." },
      originalCurrency: { type: Type.STRING, description: "3-letter currency code found on document (e.g. USD, EUR, CHF)." },
      vatAmount: { type: Type.NUMBER, description: "The VAT/TVA amount extracted or calculated in original currency." },
      netAmount: { type: Type.NUMBER, description: "The amount before tax (Net / HT) in original currency." },
      expenseCategory: { type: Type.STRING, description: "Internal category (e.g., Marketing, Travel, Maintenance, Fuel, Salary)." },
      amountInCHF: { type: Type.NUMBER, description: `The total amount converted to the target reporting currency (${targetCurrency}).` },
      conversionRateUsed: { type: Type.NUMBER, description: `Rate used to convert from originalCurrency to ${targetCurrency}.` },
      notes: { type: Type.STRING, description: "Summary of items or any anomalies found." },
      handwrittenRef: { type: Type.STRING, description: "CRITICAL: Any circled number like (1), (2) or text like 'P.3-(5)' written on the paper." },
      lineItems: {
        type: Type.ARRAY,
        description: "Detailed lines ONLY for bank statements.",
        items: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            description: { type: Type.STRING },
            amount: { type: Type.NUMBER, description: "Positive absolute value in original currency." },
            type: { type: Type.STRING, enum: ["INCOME", "EXPENSE"] },
            category: { type: Type.STRING },
            supportingDocRef: { type: Type.STRING, description: "Handwritten circled numbers found next to the line item." }
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
            text: `You are an expert Swiss Accountant. Analyze this financial document with extreme precision.
            
            REPORTING SETTING: The user wants all final reports in ${targetCurrency}.
            
            DIRECTIONS FOR ACCURACY:
            1. **IDENTIFY CURRENCY**: Check if the amount is in USD, EUR, or CHF. If it's a USD receipt (often from online tools or US travel), you MUST identify it.
            2. **CONVERSION**: If the original currency is NOT ${targetCurrency}, estimate the exchange rate for the document date (${new Date().toISOString().split('T')[0]} if not specified) and calculate 'amountInCHF' (which represents the target currency value).
            3. **IDENTIFY TOTAL**: Look for 'Total TTC', 'Total CHF', 'Total USD', 'Montant à verser'.
            4. **TAXES**: Identify VAT rates. Swiss rates: 8.1%, 2.6%.
            5. **HANDWRITTEN MARKS**: Look for handwritten circled numbers.
            6. **DOCUMENT TYPE**: 
               - Thermal paper = RECEIPT.
               - A4 = INVOICE.
               - Table with Credit/Debit = BANK_STATEMENT.
            
            Return the result in valid JSON.`
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
      
      const parsed = JSON.parse(cleanText) as FinancialData;

      // Ensure amountInCHF is treated as "amount in target currency"
      if (!parsed.conversionRateUsed && parsed.originalCurrency !== targetCurrency && parsed.amountInCHF > 0) {
        parsed.conversionRateUsed = parsed.amountInCHF / parsed.totalAmount;
      }
      
      return parsed;
    }
    throw new Error("Analysis engine returned no data.");
  } catch (error) {
    console.error("Critical Analysis Error:", error);
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
        let match = supports.find(s => {
          if (!s.handwrittenRef || !line.supportingDocRef) return false;
          const sRef = s.handwrittenRef.replace(/[^0-9]/g, '');
          const lRef = line.supportingDocRef.replace(/[^0-9]/g, '');
          return sRef === lRef && sRef !== '';
        });

        if (!match) {
          match = supports.find(s => Math.abs(s.totalAmount - line.amount) < 0.05);
        }

        if (match) {
          return {
            ...line,
            category: match.expenseCategory,
            description: `${line.description} (Linked to ${match.issuer})`,
            notes: `Auto-linked via ${match.handwrittenRef ? 'Ref: ' + match.handwrittenRef : 'Amount'}`
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
export const generateFinancialSummary = async (data: FinancialData[], targetCurrency: string): Promise<string> => {
  if (data.length === 0) return "No data provided.";
  const summaryBlob = data.map(d => `${d.documentType}: ${d.issuer} - ${d.amountInCHF.toFixed(2)} ${targetCurrency} (Orig: ${d.totalAmount} ${d.originalCurrency})`).join('\n');
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `You are a financial controller. Provide a professional summary of this batch. Reporting currency is ${targetCurrency}. Data:\n${summaryBlob}`
    });
    return response.text || "Summary generation timed out.";
  } catch (error) {
    return "Error generating summary.";
  }
};

/** Legacy compatibility for Bank Analyzer view */
export const analyzeBankStatement = async (f: File, targetCurrency: string = 'CHF') => {
  const d = await analyzeFinancialDocument(f, targetCurrency);
  return {
    accountHolder: d.issuer, 
    period: d.date, 
    currency: d.originalCurrency,
    transactions: d.lineItems || [],
    calculatedTotalIncome: d.lineItems?.filter(i => i.type === 'INCOME').reduce((s,i) => s+i.amount, 0) || 0,
    calculatedTotalExpense: d.lineItems?.filter(i => i.type === 'EXPENSE').reduce((s,i) => s+i.amount, 0) || 0
  };
};
