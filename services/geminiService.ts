
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
 * Utility for exponential backoff retries with specific RPC error handling.
 */
const withRetry = async <T>(fn: () => Promise<T>, retries = 4, delay = 2500): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = JSON.stringify(error).toLowerCase();
    const isRetryable = 
      errorStr.includes('500') || 
      errorStr.includes('xhr') || 
      errorStr.includes('proxy') || 
      errorStr.includes('timeout') ||
      errorStr.includes('code: 6') ||
      errorStr.includes('internal error');
    
    if (retries > 0 && isRetryable) {
      console.warn(`Retry logic: connection instability detected. Retrying... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

/**
 * Analyzes a financial document with high precision using Pro model for Search Grounding.
 */
export const analyzeFinancialDocument = async (file: File, targetCurrency: string = 'CHF'): Promise<FinancialData> => {
  const base64 = await fileToBase64(file);
  const mimeType = file.type;

  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const schema = {
      type: Type.OBJECT,
      properties: {
        documentType: {
          type: Type.STRING,
          enum: [DocumentType.INVOICE, DocumentType.RECEIPT, DocumentType.BANK_STATEMENT, DocumentType.UNKNOWN]
        },
        date: { type: Type.STRING, description: "Full date of document (YYYY-MM-DD)" },
        issuer: { type: Type.STRING },
        documentNumber: { type: Type.STRING },
        totalAmount: { type: Type.NUMBER },
        originalCurrency: { type: Type.STRING },
        vatAmount: { type: Type.NUMBER },
        netAmount: { type: Type.NUMBER },
        expenseCategory: { type: Type.STRING },
        amountInCHF: { type: Type.NUMBER, description: `Amount converted to ${targetCurrency}` },
        conversionRateUsed: { type: Type.NUMBER, description: "Official exchange rate used for conversion" },
        notes: { type: Type.STRING },
        handwrittenRef: { type: Type.STRING },
        lineItems: {
          type: Type.ARRAY,
          description: "MANDATORY: Extract every single transaction from every page. Scan all 30+ pages if present. NEVER summarize.",
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              description: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              type: { type: Type.STRING, enum: ["INCOME", "EXPENSE"] },
              category: { type: Type.STRING },
              supportingDocRef: { type: Type.STRING }
            },
            required: ["date", "description", "amount", "type"]
          }
        }
      },
      required: ["documentType", "totalAmount", "originalCurrency", "amountInCHF", "issuer", "conversionRateUsed"]
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64 } },
          {
            text: `AUDIT TASK: EXHAUSTIVE EXTRACTION & HIGH-PRECISION EXCHANGE RATES.
            1. Scan EVERY page of the PDF/image sequentially. Extract ALL transactions. Do NOT skip any rows or summarize.
            2. Identify the document date and original currency.
            3. If the currency is NOT ${targetCurrency}, use GOOGLE SEARCH to find the OFFICIAL exchange rate for ${targetCurrency} on the specific document date (or closest business day). 
            4. Use that accurate historical rate to calculate 'amountInCHF' (or target) and fill 'conversionRateUsed'.
            5. Provide a strict JSON output matching the schema.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const text = response.text;
    if (!text) throw new Error("AI failed to return structured data.");
    
    let cleanText = text.trim();
    if (cleanText.includes("```json")) cleanText = cleanText.split("```json")[1].split("```")[0].trim();
    else if (cleanText.includes("```")) cleanText = cleanText.split("```")[1].split("```")[0].trim();
    
    return JSON.parse(cleanText) as FinancialData;
  });
};

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

export const generateFinancialSummary = async (data: FinancialData[], targetCurrency: string): Promise<string> => {
  if (data.length === 0) return "No data.";
  const summaryBlob = data.map(d => `${d.issuer} - ${d.amountInCHF.toFixed(2)} ${targetCurrency}`).join('\n');
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a professional audit executive summary for the following batch:\n${summaryBlob}`
    });
    return response.text || "Summary failed.";
  });
};

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
        if (!match) match = supports.find(s => Math.abs(s.totalAmount - line.amount) < 0.05);
        if (match) {
          return {
            ...line,
            category: match.expenseCategory,
            description: `${line.description} (Linked to ${match.issuer})`,
            notes: `Auto-linked via Ref: ${match.handwrittenRef || 'Amt'}`
          };
        }
        return line;
      });
      return { ...doc, lineItems: reconciledLines };
    }
    return doc;
  });
};
