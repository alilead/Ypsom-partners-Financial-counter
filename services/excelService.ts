
import * as XLSX from 'xlsx';
import { FinancialData, DocumentType } from '../types';

export const exportToExcel = (data: FinancialData[], fileNamePrefix: string, reportingCurrency: string = 'CHF') => {
  if (data.length === 0) return;

  const rows: any[] = [];
  let grandTotal = 0;

  data.forEach(item => {
    const totalTarget = item.amountInCHF;
    grandTotal += totalTarget;

    rows.push({
      'Audit Date': item.date,
      'Issuer': item.issuer,
      'Document Ref': item.documentNumber || 'N/A',
      'Original Amount': `${item.totalAmount.toFixed(2)} ${item.originalCurrency}`,
      'VAT Amount': item.vatAmount?.toFixed(2) || '0.00',
      'Exchange Rate': item.conversionRateUsed?.toFixed(4) || '1.0000',
      [`Audited Total (${reportingCurrency})`]: totalTarget.toFixed(2),
      'Source File': item.notes || 'AI Extracted'
    });
  });

  rows.push({});
  rows.push({
    'Issuer': 'GRAND TOTAL AUDITED',
    [`Audited Total (${reportingCurrency})`]: `${grandTotal.toFixed(2)} ${reportingCurrency}`
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Ledger");

  worksheet['!cols'] = [{ wch: 15 }, { wch: 35 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 30 }];

  XLSX.writeFile(workbook, `${fileNamePrefix}_${new Date().toISOString().split('T')[0]}.xlsx`);
};
