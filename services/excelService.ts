
import * as XLSX from 'xlsx';
import { FinancialData, DocumentType } from '../types';

/**
 * Exports financial data to Excel matching the unified Audit Ledger.
 */
export const exportToExcel = (data: FinancialData[], fileNamePrefix: string, reportingCurrency: string = 'CHF') => {
  if (data.length === 0) {
    return;
  }

  const rows: any[] = [];
  let grandTotal = 0;

  data.forEach(item => {
    const origAmt = item.totalAmount;
    const vat = item.vatAmount || 0;
    const exRate = item.conversionRateUsed || 1;
    const totalTarget = item.amountInCHF;

    // Check if it's a statement with line items to expand for a sub-audit report
    if (item.documentType === DocumentType.BANK_STATEMENT && item.lineItems && item.lineItems.length > 0) {
      rows.push({
        'Type': 'STATEMENT HEADER',
        'Date': item.date,
        'Issuer': item.issuer,
        'Original Amount': `${origAmt.toFixed(2)} ${item.originalCurrency}`,
        'VAT': vat.toFixed(2),
        'Exchange Rate': exRate.toFixed(4),
        [`Total (${reportingCurrency})`]: totalTarget.toFixed(2),
        'Audit Ref': item.documentNumber
      });

      item.lineItems.forEach(line => {
        rows.push({
          'Type': `  -> Transaction`,
          'Date': line.date,
          'Issuer': `Ref: ${line.description}`,
          'Original Amount': `${line.amount.toFixed(2)} ${item.originalCurrency}`,
          'VAT': '0.00',
          'Exchange Rate': exRate.toFixed(4),
          [`Total (${reportingCurrency})`]: (line.amount * exRate).toFixed(2),
          'Audit Ref': line.notes || 'No Evidence Link'
        });
      });
      grandTotal += totalTarget;
    } else {
      grandTotal += totalTarget;
      rows.push({
        'Type': item.documentType,
        'Date': item.date,
        'Issuer': item.issuer,
        'Original Amount': `${origAmt.toFixed(2)} ${item.originalCurrency}`,
        'VAT': vat.toFixed(2),
        'Exchange Rate': exRate.toFixed(4),
        [`Total (${reportingCurrency})`]: totalTarget.toFixed(2),
        'Audit Ref': item.documentNumber
      });
    }
  });

  rows.push({});
  rows.push({
    'Type': '',
    'Date': '',
    'Issuer': 'GRAND TOTAL AUDITED',
    'Original Amount': '',
    'VAT': '',
    'Exchange Rate': '',
    [`Total (${reportingCurrency})`]: `${grandTotal.toFixed(2)} ${reportingCurrency}`,
    'Audit Ref': ''
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Unified_Audit_Ledger");

  worksheet['!cols'] = [
    { wch: 20 }, // Type
    { wch: 15 }, // Date
    { wch: 40 }, // Issuer
    { wch: 20 }, // Original Amount
    { wch: 12 }, // VAT
    { wch: 15 }, // Exchange Rate
    { wch: 20 }, // Total
    { wch: 25 }  // Ref
  ];

  XLSX.writeFile(workbook, `${fileNamePrefix}_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
};
