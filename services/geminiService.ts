
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

/**
 * Fetches real-time exchange rates as a fallback/verification for AI extraction.
 */
export const getLiveExchangeRate = async (from: string, to: string): Promise<number> => {
  if (from === to) return 1.0;
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
    const data = await res.json();
    return data.rates[to] || 1.0;
  } catch (e) {
    console.error("Currency API failure, falling back to AI estimation", e);
    return 1.0;
  }
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
          description: "The business brand name. Ignore operational labels." 
        },
        documentNumber: { type: Type.STRING },
        totalAmount: { type: Type.NUMBER, description: "Set to 0 if not detectable or blurred." },
        originalCurrency: { type: Type.STRING },
        vatAmount: { type: Type.NUMBER },
        netAmount: { type: Type.NUMBER },
        expenseCategory: { type: Type.STRING },
        amountInCHF: { type: Type.NUMBER, description: `The total amount converted to ${targetCurrency}` },
        conversionRateUsed: { type: Type.NUMBER, description: `The exchange rate used to convert to ${targetCurrency}` },
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
              category: { type: Type.STRING }
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
            
            ACCURACY INSTRUCTIONS:
            1. Detect original currency and total amount. If blurred/missing, return totalAmount: 0.
            2. Convert to ${targetCurrency}. Use current market rates if not found on page.
            3. Explicitly look for tax/VAT amounts.
            4. If it's a Bank Statement, extract all transactions individually.
            
            Use Google Search to verify the exchange rate for the document date if possible.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text;
    if (!text) throw new Error("AI Engine failure.");
    
    const parsed = JSON.parse(text) as FinancialData;

    // Safety fallback for conversions
    if (!parsed.amountInCHF && parsed.totalAmount > 0) {
      const liveRate = await getLiveExchangeRate(parsed.originalCurrency || 'EUR', targetCurrency);
      parsed.amountInCHF = parsed.totalAmount * liveRate;
      parsed.conversionRateUsed = liveRate;
    }

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
          { text: `Extract bank transactions into JSON. Convert amounts to relative ${targetCurrency} if necessary.` }
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

export const generateAuditSummary = async (data: FinancialData[], currency: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const context = JSON.stringify(data);
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze this audit data and provide a professional executive summary in ${currency}. Use Markdown.`
  });
  
  return response.text || "Summary generation failed.";
};
