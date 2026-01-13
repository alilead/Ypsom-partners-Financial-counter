
export enum DocumentType {
  BANK_STATEMENT = 'Bank Statement',
  INVOICE = 'Invoice',
  RECEIPT = 'Receipt',
  UNKNOWN = 'Unknown'
}

export interface BankTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  category: string; // e.g. Food, Salary, Rent, Utilities
  supportingDocRef?: string;
  notes?: string;
}

export interface FinancialData {
  documentType: DocumentType;
  date: string;
  issuer: string;
  documentNumber: string;
  totalAmount: number;
  originalCurrency: string;
  vatAmount: number;
  netAmount: number;
  expenseCategory: string;
  amountInCHF: number;
  conversionRateUsed: number;
  notes: string;
  lineItems?: BankTransaction[];
  handwrittenRef?: string;
  groundingUrls?: string[]; 
}

export interface ProcessedDocument {
  id: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  data?: FinancialData;
  error?: string;
  fileRaw?: File;
}

/**
 * Fix: Added missing ProcessedBankStatement interface for bank-specific reconciliation workflows.
 */
export interface ProcessedBankStatement {
  id: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  data?: BankStatementAnalysis;
  error?: string;
  fileRaw?: File;
}

export interface BankStatementAnalysis {
  accountHolder: string;
  period: string;
  currency: string;
  transactions: BankTransaction[];
  calculatedTotalIncome?: number;
  calculatedTotalExpense?: number;
  openingBalance?: number;
  closingBalance?: number;
}