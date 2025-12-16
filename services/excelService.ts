import * as XLSX from 'xlsx';
import { FinancialData, DocumentType } from '../types';

export const exportToExcel = (data: FinancialData[], type: DocumentType) => {
  // Filter data by type
  const filteredData = data.filter(d => d.documentType === type);

  if (filteredData.length === 0) {
    alert(`No records found for ${type}`);
    return;
  }

  // Map to flat structure for Excel
  const rows = filteredData.map(item => ({
    Date: item.date,
    Issuer: item.issuer,
    'Doc Number': item.documentNumber,
    'Total (Original)': item.totalAmount,
    Currency: item.originalCurrency,
    'Net Amount': item.netAmount,
    'VAT Amount': item.vatAmount,
    Category: item.expenseCategory,
    'Total (CHF)': item.amountInCHF,
    'Ex. Rate': item.conversionRateUsed,
    Notes: item.notes
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  
  // Clean filename
  const sheetName = type.replace(/\s+/g, '_');
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  XLSX.writeFile(workbook, `${sheetName}s.xlsx`);
};
