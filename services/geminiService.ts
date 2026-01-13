
import { GoogleGenAI, Type } from "@google/genai";
import { DocumentType, FinancialData, BankStatementAnalysis, BankTransaction } from "../types";

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
 * Utility for exponential backoff retries.
 */
const withRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

/**
 * Analyzes a financial document using Gemini 3.0 Flash.
 * Optimized for high-accuracy extraction with filename context.
 */
export const analyzeFinancialDocument = async (file: File, targetCurrency: string = 'CHF'): Promise<FinancialData> => {
  const base64 = await fileToBase64(file);
  const mimeType = file.type;
  const fullFileName = file.name;

  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const schema = {
      type: Type.OBJECT,
      properties: {
        documentType: {
          type: Type.STRING,
          enum: [DocumentType.INVOICE, DocumentType.RECEIPT, DocumentType.BANK_STATEMENT, DocumentType.UNKNOWN]
        },
        date: { type: Type.STRING, description: "Format: YYYY-MM-DD" },
        issuer: { type: Type.STRING },
        documentNumber: { type: Type.STRING },
        totalAmount: { type: Type.NUMBER },
        originalCurrency: { type: Type.STRING, description: "ISO code found on document" },
        vatAmount: { type: Type.NUMBER },
        netAmount: { type: Type.NUMBER },
        expenseCategory: { type: Type.STRING },
        amountInCHF: { type: Type.NUMBER, description: "Converted amount to target currency" },
        conversionRateUsed: { type: Type.NUMBER },
        notes: { type: Type.STRING },
        lineItems: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              description: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              type: { type: Type.STRING, enum: ["INCOME", "EXPENSE"] }
            },
            required: ["date", "description", "amount", "type"]
          }
        }
      },
      required: ["documentType", "totalAmount", "originalCurrency", "issuer", "date"]
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64 } },
          {
            text: `Audit Request: Extract structured financial data from this file: "${fullFileName}".
            Instructions:
            1. Precisely identify if it is an Invoice, Receipt, or Bank Statement.
            2. Preserve the Original Currency found on the document.
            3. If it's a Bank Statement, extract EVERY single transaction into 'lineItems'.
            4. Convert the total sum to ${targetCurrency} using standard rates.
            5. If document is illegible or not financial, return totalAmount: 0 and notes: "NO_DATA_DETECTED".`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const text = response.text;
    if (!text) throw new Error("AI Engine: No response payload.");
    
    const parsed = JSON.parse(text) as FinancialData;

    // Strict Validation
    if (parsed.notes === "NO_DATA_DETECTED" || (parsed.totalAmount === 0 && parsed.documentType !== DocumentType.BANK_STATEMENT)) {
      throw new Error("Validation Failure: No legible financial amounts found. Please check document quality.");
    }

    if (!parsed.date || parsed.date.toLowerCase().includes("unknown")) {
      throw new Error("Validation Failure: Transaction date could not be determined.");
    }

    // Default Fallbacks
    if (!parsed.amountInCHF) parsed.amountInCHF = parsed.totalAmount;
    if (!parsed.conversionRateUsed) parsed.conversionRateUsed = 1;

    return parsed;
  });
};

export const analyzeBankStatement = async (f: File, targetCurrency: string = 'CHF'): Promise<BankStatementAnalysis> => {
  const financialData = await analyzeFinancialDocument(f, targetCurrency);
  const transactions = financialData.lineItems || [];
  
  return {
    accountHolder: financialData.issuer,
    period: financialData.date,
    currency: financialData.originalCurrency,
    transactions: transactions,
    calculatedTotalIncome: transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0),
    calculatedTotalExpense: transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0),
    openingBalance: 0,
    closingBalance: financialData.totalAmount
  };
};
