
import { GoogleGenAI, Type } from "@google/genai";
import { DocumentType, FinancialData, BankTransaction, BankStatementAnalysis } from "../types";

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

export const getLiveExchangeRate = async (from: string, to: string): Promise<number> => {
  if (!from || from === to || from === '---') return 1.0;
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
    const data = await res.json();
    return data.rates[to] || 1.0;
  } catch (e) {
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

export const analyzeFinancialDocument = async (
  file: File, 
  targetCurrency: string = 'CHF', 
  userHint?: string
): Promise<FinancialData> => {
  const base64 = await fileToBase64(file);
  const mimeType = file.type;

  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const coreSchema: any = {
      type: Type.OBJECT,
      properties: {
        documentType: {
          type: Type.STRING,
          enum: ["Bank Statement", "Invoice", "Ticket/Receipt", "Z2 Multi-Ticket Sheet", "Bank Deposit", "Unknown"],
          description: "MANDATORY: Use 'Bank Deposit' for ATM/Bank confirmations. Use 'Z2 Multi-Ticket Sheet' ONLY if the file contains 2 or more distinct receipts/invoices."
        },
        date: { type: Type.STRING, description: "YYYY-MM-DD" },
        issuer: { type: Type.STRING, description: "Primary entity name." },
        documentNumber: { type: Type.STRING },
        totalAmount: { type: Type.NUMBER },
        originalCurrency: { type: Type.STRING },
        vatAmount: { type: Type.NUMBER },
        expenseCategory: { 
          type: Type.STRING,
          description: "e.g. Salary, Rent, Beauty, Travel, Shopping, Health, Cash Deposit, Utility, Groceries, Software, Bank. If ambiguous, provide a specific label."
        },
        amountInCHF: { type: Type.NUMBER },
        notes: { type: Type.STRING },
        aiInterpretation: { type: Type.STRING, description: "Diagnostic explanation of the scan result." },
        confidenceScore: { type: Type.NUMBER },
        forensicAlerts: { type: Type.ARRAY, items: { type: Type.STRING } },
        openingBalance: { type: Type.NUMBER },
        finalBalance: { type: Type.NUMBER, description: "The final balance (solde) shown on the bank document." },
        calculatedTotalIncome: { type: Type.NUMBER },
        calculatedTotalExpense: { type: Type.NUMBER },
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
            }
          }
        },
        subDocuments: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              issuer: { type: Type.STRING },
              date: { type: Type.STRING },
              totalAmount: { type: Type.NUMBER },
              originalCurrency: { type: Type.STRING },
              documentType: { type: Type.STRING, enum: ["VOUCHER", "TICKET/RECEIPT", "BANK_DEPOSIT"] },
              expenseCategory: { type: Type.STRING },
            }
          }
        }
      },
      required: ["documentType", "totalAmount", "originalCurrency", "issuer", "expenseCategory"]
    };

    const hintSection = userHint ? `USER OVERRIDE HINT: "${userHint}".` : "";

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64 } },
          {
            text: `AUDIT INTELLIGENCE MISSION (DEEP SCAN):
            ${hintSection}
            
            1. MULTI-PAGE SCAN: This file might have dozens of pages. Scan EVERY page.
            2. ASSET ISOLATION: Identify every separate transaction confirmation. If multiple exist, use 'Z2 Multi-Ticket Sheet' and list them in 'subDocuments'.
            3. BANK STATEMENTS: If this is a bank statement, extract EVERY transaction from EVERY page into 'lineItems'. Find the opening balance and the final balance (solde). Calculate the total income and total expense shown.
            4. CATEGORY FIDELITY: Suggest the most accurate financial category string.
            
            Return JSON only.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: coreSchema,
      }
    });

    const parsed = JSON.parse(response.text) as FinancialData;

    if (parsed.subDocuments && parsed.subDocuments.length > 0) {
       const sum = parsed.subDocuments.reduce((s, doc) => s + (doc.totalAmount || 0), 0);
       if (!parsed.totalAmount || parsed.totalAmount === 0) {
          parsed.totalAmount = sum;
       }
    }

    if (parsed.totalAmount !== undefined && (!parsed.amountInCHF || parsed.amountInCHF === 0)) {
      const rate = await getLiveExchangeRate(parsed.originalCurrency || 'CHF', targetCurrency);
      parsed.amountInCHF = parsed.totalAmount * rate;
      parsed.conversionRateUsed = rate;
    }

    return parsed;
  });
};

// Fixed analyzeBankStatement to properly handle the GenAI response and return BankStatementAnalysis
export const analyzeBankStatement = async (file: File, targetCurrency: string = 'CHF'): Promise<BankStatementAnalysis> => {
  const base64 = await fileToBase64(file);
  const mimeType = file.type;

  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64 } },
          {
            text: `Extract the full multi-page transaction ledger from this bank statement. You MUST find the opening balance and final balance (solde).`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
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
                required: ["date", "description", "amount", "type"]
              }
            },
            calculatedTotalIncome: { type: Type.NUMBER },
            calculatedTotalExpense: { type: Type.NUMBER },
            openingBalance: { type: Type.NUMBER },
            finalBalance: { type: Type.NUMBER },
            currency: { type: Type.STRING },
            period: { type: Type.STRING }
          },
          required: ["transactions", "calculatedTotalIncome", "calculatedTotalExpense", "currency"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI engine");
    return JSON.parse(text) as BankStatementAnalysis;
  });
};
