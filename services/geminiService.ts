

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
      errorStr.includes('internal error') ||
      errorStr.includes('thinking');
    
    if (retries > 0 && isRetryable) {
      console.warn(`Audit System: Retrying due to connection instability... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

/**
 * Analyzes a financial document with high precision using Gemini 3 Pro.
 * Optimized for exhaustive 30+ page capture and accurate exchange rates.
 */
export const analyzeFinancialDocument = async (file: File, targetCurrency: string = 'CHF'): Promise<FinancialData> => {
  const base64 = await fileToBase64(file);
  const mimeType = file.type;

  return withRetry(async () => {
    // New instance per request for fresh context and API key
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
        amountInCHF: { type: Type.NUMBER, description: `Precision conversion to ${targetCurrency}` },
        conversionRateUsed: { type: Type.NUMBER, description: "Historical mid-market rate found via Search" },
        notes: { type: Type.STRING },
        handwrittenRef: { type: Type.STRING },
        lineItems: {
          type: Type.ARRAY,
          description: "MANDATORY: List EVERY SINGLE row from ALL pages. NEVER summarize.",
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
      required: ["documentType", "totalAmount", "originalCurrency", "amountInCHF", "issuer", "conversionRateUsed", "date"]
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64 } },
          {
            text: `AUDIT PROTOCOL: HIGH ACCURACY & TOTAL ENUMERATION.
            1. Scan ALL pages of the document. Extract EVERY single table row. Do NOT truncate or summarize.
            2. For the date identified on the document, use GOOGLE SEARCH to find the EXACT historical mid-market exchange rate between the document's currency and ${targetCurrency}.
            3. Use that rate to calculate 'amountInCHF'.
            4. If the document is illegible or contains no financial amounts, ensure totalAmount is returned as 0.
            5. Output ONLY valid JSON.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        tools: [{ googleSearch: {} }],
        // Critical: Set both maxOutputTokens and thinkingBudget to avoid Budget 0 error
        maxOutputTokens: 65536,
        thinkingBudget: 32768
      }
    });

    const text = response.text;
    if (!text) throw new Error("Cloud analysis failed to return data.");
    
    let cleanText = text.trim();
    if (cleanText.includes("```json")) cleanText = cleanText.split("```json")[1].split("```")[0].trim();
    else if (cleanText.includes("```")) cleanText = cleanText.split("```")[1].split("```")[0].trim();
    
    const parsed = JSON.parse(cleanText) as FinancialData;

    // Fix: Extract grounding URLs from groundingMetadata as required when using googleSearch tool
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
      parsed.groundingUrls = groundingChunks
        .filter((chunk: any) => chunk.web && chunk.web.uri)
        .map((chunk: any) => chunk.web.uri);
    }
    
    // VALIDATION: If total is 0.00, it's a failed extraction
    if (!parsed.totalAmount || parsed.totalAmount === 0) {
      throw new Error("Extraction failed: Total amount is 0.00. Please re-upload a clearer image.");
    }

    // Safety check for rates if search fails
    if (!parsed.conversionRateUsed || parsed.conversionRateUsed === 0) {
      parsed.conversionRateUsed = parsed.originalCurrency === targetCurrency ? 1 : (parsed.amountInCHF / parsed.totalAmount);
    }

    return parsed;
  });
};

export const analyzeBankStatement = async (f: File, targetCurrency: string = 'CHF') => {
  const d = await analyzeFinancialDocument(f, targetCurrency);
  
  if (!d.lineItems || d.lineItems.length === 0) {
    throw new Error("No transactions found in this statement. Please check document quality.");
  }

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
  const summaryBlob = data.map(d => `${d.issuer}: ${d.amountInCHF.toFixed(2)} ${targetCurrency}`).join('\n');
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Provide a high-level executive summary for this financial audit batch:\n${summaryBlob}`
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