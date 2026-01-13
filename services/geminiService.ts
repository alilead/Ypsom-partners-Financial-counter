
import { GoogleGenAI, Type } from "@google/genai";
import { DocumentType, FinancialData, BankStatementAnalysis, BankTransaction } from "../types";

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
        issuer: { 
          type: Type.STRING, 
          description: "The business brand name. Ignore 'Eat In', 'Table', etc." 
        },
        documentNumber: { type: Type.STRING },
        totalAmount: { type: Type.NUMBER },
        originalCurrency: { type: Type.STRING },
        vatAmount: { type: Type.NUMBER },
        netAmount: { type: Type.NUMBER },
        expenseCategory: { type: Type.STRING },
        amountInCHF: { type: Type.NUMBER },
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
              type: { type: Type.STRING, enum: ["INCOME", "EXPENSE"] },
              category: { type: Type.STRING, description: "e.g. Salary, Rent, Groceries, Shopping, Travel, Health" }
            },
            required: ["date", "description", "amount", "type", "category"]
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
            text: `Extract structured data from "${fullFileName}". 
            If it's a Bank Statement: extract EVERY transaction accurately. 
            Assign each transaction a category (Salary, Rent, Groceries, Utility, etc.).
            Maintain the table structure from the document.
            Ensure the issuer name is the bank's name or the vendor's name, not operational labels.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const text = response.text;
    if (!text) throw new Error("AI Engine failure.");
    
    const parsed = JSON.parse(text) as FinancialData;

    if (!parsed.amountInCHF) parsed.amountInCHF = parsed.totalAmount;
    if (!parsed.conversionRateUsed) parsed.conversionRateUsed = 1;

    return parsed;
  });
};

export const analyzeBankStatement = async (file: File, targetCurrency: string = 'CHF'): Promise<BankStatementAnalysis> => {
  const base64 = await fileToBase64(file);
  const mimeType = file.type;

  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const schema = {
      type: Type.OBJECT,
      properties: {
        accountHolder: { type: Type.STRING },
        period: { type: Type.STRING },
        currency: { type: Type.STRING },
        transactions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              description: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              type: { type: Type.STRING, enum: ["INCOME", "EXPENSE"] },
              category: { type: Type.STRING }
            },
            required: ["date", "description", "amount", "type", "category"]
          }
        },
        calculatedTotalIncome: { type: Type.NUMBER },
        calculatedTotalExpense: { type: Type.NUMBER },
        openingBalance: { type: Type.NUMBER },
        closingBalance: { type: Type.NUMBER }
      },
      required: ["accountHolder", "period", "currency", "transactions"]
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64 } },
          { text: "Precisely extract all transactions from this bank statement into the requested JSON format." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const text = response.text;
    if (!text) throw new Error("AI Engine failure.");
    return JSON.parse(text) as BankStatementAnalysis;
  });
};

/**
 * Generates an executive summary of all processed documents.
 */
export const generateAuditSummary = async (data: FinancialData[], currency: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const context = JSON.stringify(data);
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Based on the following audit data, provide a professional executive summary of all expenses and receipts. 
    Highlight the total spending in ${currency}, the major categories of expenditure, any notable trends, and a breakdown of high-value items.
    Use Markdown for formatting.
    
    Audit Data: ${context}`
  });
  
  return response.text || "Summary generation failed.";
};
