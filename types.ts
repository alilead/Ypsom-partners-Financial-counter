export enum DocumentType {
  BANK_STATEMENT = 'Bank Statement',
  INVOICE = 'Invoice',
  RECEIPT = 'Receipt',
  UNKNOWN = 'Unknown'
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
}

export interface ProcessedDocument {
  id: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  data?: FinancialData;
  error?: string;
  fileRaw?: File;
}
