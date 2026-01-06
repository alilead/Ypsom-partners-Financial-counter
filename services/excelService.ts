
import * as XLSX from 'xlsx';
import { FinancialData, DocumentType } from '../types';

/**
 * Exports financial data to Excel matching the UI table exactly.
 * Columns: Date, Issuer, Original Amount, VAT, Exchange Rate, Total (Converted)
 * Includes a summary TOTAL row at the bottom with the currency.
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

    // Check if it's a statement with line items to expand
    if (item.documentType === DocumentType.BANK_STATEMENT && item.lineItems && item.lineItems.length > 0) {
      item.lineItems.forEach(line => {
        const lineTotal = line.amount * exRate;
        grandTotal += lineTotal;
        rows.push({
          'Date': line.date,
          'Issuer': item.issuer,
          'Original Amount': `${line.amount.toFixed(2)} ${item.originalCurrency}`,
          'VAT': '0.00',
          'Exchange Rate': exRate.toFixed(4),
          [`Total (${reportingCurrency})`]: lineTotal.toFixed(2)
        });
      });
    } else {
      // Direct receipt or invoice entry
      grandTotal += totalTarget;
      rows.push({
        'Date': item.date,
        'Issuer': item.issuer,
        'Original Amount': `${origAmt.toFixed(2)} ${item.originalCurrency}`,
        'VAT': vat.toFixed(2),
        'Exchange Rate': exRate.toFixed(4),
        [`Total (${reportingCurrency})`]: totalTarget.toFixed(2)
      });
    }
  });

  // Add an empty row for spacing
  rows.push({});

  // Add the TOTAL row
  rows.push({
    'Date': '',
    'Issuer': 'GRAND TOTAL',
    'Original Amount': '',
    'VAT': '',
    'Exchange Rate': '',
    [`Total (${reportingCurrency})`]: `${grandTotal.toFixed(2)} ${reportingCurrency}`
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Audit_Ledger");

  // Format column widths for a professional look
  worksheet['!cols'] = [
    { wch: 15 }, // Date
    { wch: 30 }, // Issuer
    { wch: 20 }, // Original Amount
    { wch: 12 }, // VAT
    { wch: 15 }, // Exchange Rate
    { wch: 18 }  // Total
  ];

  XLSX.writeFile(workbook, `${fileNamePrefix}_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
};
