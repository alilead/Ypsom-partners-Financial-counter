export interface Client {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export enum DocumentType {
  BANK_STATEMENT = 'Bank Statement',
  INVOICE = 'Invoice',
  RECEIPT = 'Ticket/Receipt',
  Z2_BULK_REPORT = 'Z2 Multi-Ticket Sheet',
  BANK_DEPOSIT = 'Bank Deposit',
  UNKNOWN = 'Unknown'
}

export interface BankTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  category: string; 
  notes?: string;
  quantity?: number;
  unitPrice?: number;
  isHumanVerified?: boolean;
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
  subDocuments?: FinancialData[]; 
  forensicAlerts?: string[];
  groundingUrls?: string[];
  aiInterpretation?: string;
  confidenceScore?: number;
  isHumanVerified?: boolean;
  // Bank specific fields for audit
  openingBalance?: number;
  finalBalance?: number;
  calculatedTotalIncome?: number;
  calculatedTotalExpense?: number;
}

export interface ProcessedDocument {
  id: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error' | 'verifying';
  data?: FinancialData;
  error?: string;
  fileRaw?: File;
}

export interface BankStatementAnalysis {
  transactions: BankTransaction[];
  calculatedTotalIncome: number;
  calculatedTotalExpense: number;
  openingBalance?: number;
  finalBalance?: number;
  currency: string;
  period?: string;
}

export interface ProcessedBankStatement {
  id: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  data?: BankStatementAnalysis;
  error?: string;
  fileRaw?: File;
}
