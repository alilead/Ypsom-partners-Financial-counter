
import * as XLSX from 'xlsx';
import { FinancialData, DocumentType } from '../types';

/**
 * Exports financial data to Excel with absolute transparency.
 * If a document has line items (Statements/Detailed Invoices), every item gets its own row.
 */
export const exportToExcel = (data: FinancialData[], fileNamePrefix: string) => {
  if (data.length === 0) {
    return;
  }

  const rows: any[] = [];

  data.forEach(item => {
    if (item.lineItems && item.lineItems.length > 0) {
      // For bank statements and detailed invoices, expand all transactions
      item.lineItems.forEach(line => {
        rows.push({
          'Audit Category': item.documentType,
          'Doc Date': item.date,
          'Merchant/Issuer': item.issuer,
          'Ref Number': item.documentNumber || '',
          'Trans Date': line.date,
          'Description': line.description,
          'Orig Amount': line.amount,
          'Currency': item.originalCurrency,
          'Type': line.type,
          'VAT': item.vatAmount || 0,
          'Amount (CHF)': (line.amount * (item.conversionRateUsed || 1)).toFixed(2),
          'Ex. Rate': item.conversionRateUsed || 1,
          'Handwritten Ref': item.handwrittenRef || line.supportingDocRef || '',
          'Notes': line.notes || item.notes || ''
        });
      });
    } else {
      // Simple row for single-entry receipts or invoices
      rows.push({
        'Audit Category': item.documentType,
        'Doc Date': item.date,
        'Merchant/Issuer': item.issuer,
        'Ref Number': item.documentNumber || '',
        'Trans Date': item.date,
        'Description': `Total from ${item.documentType}`,
        'Orig Amount': item.totalAmount,
        'Currency': item.originalCurrency,
        'Type': 'EXPENSE',
        'VAT': item.vatAmount || 0,
        'Amount (CHF)': item.amountInCHF.toFixed(2),
        'Ex. Rate': item.conversionRateUsed || 1,
        'Handwritten Ref': item.handwrittenRef || '',
        'Notes': item.notes || ''
      });
    }
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Audit_Ledger");

  // Aesthetic column widths
  worksheet['!cols'] = [
    {wch: 15}, {wch: 12}, {wch: 25}, {wch: 15}, {wch: 12}, {wch: 40}, 
    {wch: 12}, {wch: 10}, {wch: 10}, {wch: 10}, {wch: 15}, {wch: 10}, {wch: 15}, {wch: 25}
  ];

  XLSX.writeFile(workbook, `${fileNamePrefix}_${new Date().toISOString().split('T')[0]}.xlsx`);
};
