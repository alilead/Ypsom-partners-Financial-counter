
import React, { useState, useRef, useMemo } from 'react';
import { Upload, FileText, CheckCircle, Wallet, RefreshCcw, Download, Trash2, FileSpreadsheet, AlertTriangle, X, Link, Search, FileCheck, XCircle, FileUp } from 'lucide-react';
import { analyzeBankStatement } from '../services/geminiService';
import { ProcessedBankStatement, BankStatementAnalysis, FinancialData } from '../types';
import * as XLSX from 'xlsx';

interface Notification {
  id: string;
  message: string;
  type: 'warning' | 'error' | 'success';
}

interface SupportingDoc extends FinancialData {
  sourceFile: string;
}

interface BankStatementAnalyzerProps {
  supportingInvoices: SupportingDoc[];
}

export const BankStatementAnalyzer: React.FC<BankStatementAnalyzerProps> = ({ supportingInvoices }) => {
  const [statements, setStatements] = useState<ProcessedBankStatement[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [reportingCurrency, setReportingCurrency] = useState('CHF');
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const dragCounter = useRef(0);
  const stopProcessingRef = useRef(false);

  const stats = useMemo(() => {
    const total = statements.length;
    const completed = statements.filter(s => s.status === 'completed').length;
    const pending = statements.filter(s => s.status === 'pending').length;
    const errors = statements.filter(s => s.status === 'error').length;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    return { total, pending, progress, errors };
  }, [statements]);

  const addNotification = (message: string, type: 'warning' | 'error' | 'success' = 'warning') => {
    const id = Math.random().toString(36).substring(7);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const removeFile = (id: string) => {
    if (isProcessing) return;
    setStatements(prev => prev.filter(s => s.id !== id));
  };

  const addFiles = (files: File[]) => {
    const newValidFiles: ProcessedBankStatement[] = [];
    
    files.forEach(file => {
      const isDuplicate = statements.some(d => d.fileName === file.name && d.fileRaw?.size === file.size);
      if (isDuplicate) {
        addNotification(`Bank statement already in queue: ${file.name}`, 'warning');
      } else {
        newValidFiles.push({
          id: Math.random().toString(36).substr(2, 9),
          fileName: file.name,
          status: 'pending' as const,
          fileRaw: file
        });
      }
    });

    if (newValidFiles.length > 0) {
      setStatements(prev => [...prev, ...newValidFiles]);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      addFiles(Array.from(event.target.files));
      event.target.value = '';
    }
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
      e.dataTransfer.clearData();
    }
  };

  const processQueue = async () => {
    setIsProcessing(true);
    stopProcessingRef.current = false;
    
    const pendingIndices = statements
      .map((s, i) => (s.status === 'pending' || s.status === 'error') ? i : -1)
      .filter(i => i !== -1);

    for (const index of pendingIndices) {
      if (stopProcessingRef.current) break;
      
      const doc = statements[index];
      if (!doc.fileRaw) continue;

      setStatements(prev => prev.map((d, i) => i === index ? { ...d, status: 'processing', error: undefined } : d));

      try {
          const result = await analyzeBankStatement(doc.fileRaw, reportingCurrency);
          
          const reconciledTransactions = result.transactions.map(transaction => {
            let match = supportingInvoices.find(inv => {
              if (!inv.handwrittenRef || !transaction.supportingDocRef) return false;
              const invRef = inv.handwrittenRef.replace(/[^0-9]/g, '');
              const bankRef = transaction.supportingDocRef.replace(/[^0-9]/g, '');
              return invRef === bankRef && invRef !== '';
            });

            if (!match) {
              match = supportingInvoices.find(inv => {
                const amountMatch = Math.abs(inv.totalAmount - transaction.amount) < 0.05;
                const issuerMatch = transaction.description.toLowerCase().includes(inv.issuer.toLowerCase());
                return amountMatch && issuerMatch;
              });
            }

            if (!match) {
               match = supportingInvoices.find(inv => Math.abs(inv.totalAmount - transaction.amount) < 0.01);
            }

            if (match) {
              return {
                ...transaction,
                notes: `Verified: Matched with ${match.sourceFile} (${match.issuer})`,
                category: transaction.category || match.expenseCategory,
                supportingDocRef: match.handwrittenRef || 'Matched by Amount'
              };
            }
            return transaction;
          });

          const finalizedData = { ...result, transactions: reconciledTransactions };

          setStatements(prev => prev.map((d, i) => i === index ? { ...d, status: 'completed', data: finalizedData } : d));
          if (!selectedStatementId) setSelectedStatementId(doc.id);
      } catch (err: any) {
          console.error("Statement extraction error:", err);
          setStatements(prev => prev.map((d, i) => i === index ? { ...d, status: 'error', error: err.message } : d));
          addNotification(`${doc.fileName}: ${err.message}`, 'error');
      }
    }
    setIsProcessing(false);
  };

  const exportToExcel = (data: BankStatementAnalysis, fileName: string) => {
    const rows: any[] = data.transactions.map(t => ({
        Date: t.date,
        Description: t.description,
        Type: t.type,
        'Amount': t.amount,
        Category: t.category || '',
        Currency: data.currency,
        'Audit Evidence': t.notes || 'Pending Evidence'
    }));
    
    // Add spacer
    rows.push({});
    
    // Calculate and add Grand Total row
    const totalIncome = data.calculatedTotalIncome || 0;
    const totalExpense = data.calculatedTotalExpense || 0;
    const netCashFlow = totalIncome - totalExpense;
    
    rows.push({
      Date: '',
      Description: 'NET CASH FLOW',
      Type: '',
      'Amount': `${netCashFlow.toFixed(2)} ${data.currency}`,
      Category: '',
      Currency: '',
      'Audit Evidence': 'Calculated by Audit System'
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reconciled Ledger");
    XLSX.writeFile(workbook, `Reconciled_${fileName.split('.')[0]}.xlsx`);
  };

  const activeStatement = statements.find(s => s.id === selectedStatementId);
  
  const reconciledCount = useMemo(() => {
    if (!activeStatement?.data) return 0;
    return activeStatement.data.transactions.filter(t => t.notes?.startsWith('Verified')).length;
  }, [activeStatement]);

  return (
    <div 
      className={`space-y-6 relative pb-12 transition-all duration-300 ${isDragging ? 'scale-[1.01]' : ''}`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
        {/* Drag Overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-[60] bg-ypsom-deep/10 border-4 border-dashed border-ypsom-deep rounded-sm flex flex-col items-center justify-center backdrop-blur-[2px] pointer-events-none animate-in fade-in duration-200">
            <FileUp className="w-16 h-16 text-ypsom-deep mb-4 animate-bounce" />
            <p className="text-xl font-bold text-ypsom-deep uppercase tracking-widest">Release to Upload Statement</p>
            <p className="text-sm text-ypsom-slate font-medium">Bank Statement PDF Reconciliation</p>
          </div>
        )}

        <div className="fixed top-24 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
          {notifications.map(n => (
            <div key={n.id} className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-sm shadow-xl border-l-4 animate-in slide-in-from-right duration-300 ${
              n.type === 'warning' ? 'bg-amber-50 border-amber-500 text-amber-800' :
              n.type === 'error' ? 'bg-red-50 border-red-500 text-red-800' : 'bg-green-50 border-green-500 text-green-800'
            }`}>
              {n.type === 'warning' && <AlertTriangle className="w-4 h-4" />}
              {n.type === 'error' && <XCircle className="w-4 h-4" />}
              {n.type === 'success' && <CheckCircle className="w-4 h-4" />}
              <span className="text-xs font-bold">{n.message}</span>
              <button onClick={() => setNotifications(prev => prev.filter(notif => notif.id !== n.id))} className="ml-2">
                <X className="w-3 h-3 opacity-50 hover:opacity-100" />
              </button>
            </div>
          ))}
        </div>

        <div className="bg-white p-6 rounded-sm shadow-sm border border-ypsom-alice flex flex-col gap-6">
            <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-ypsom-deep mb-2 flex items-center">
                        <Wallet className="w-6 h-6 mr-2" />
                        Reconciliation Workbench
                    </h2>
                    <p className="text-sm text-ypsom-slate mb-6">
                        System reconciles bank entries with processed audit evidence using reference and amount matching.
                    </p>
                    
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                      <div className="w-full md:w-48">
                        <label className="block text-[10px] font-bold text-ypsom-slate uppercase tracking-wider mb-2">Target Currency</label>
                        <select 
                          value={reportingCurrency}
                          onChange={(e) => setReportingCurrency(e.target.value)}
                          disabled={isProcessing}
                          className="w-full px-3 py-2 border border-ypsom-alice rounded-sm bg-white text-sm font-bold text-ypsom-deep outline-none focus:ring-1 focus:ring-ypsom-deep"
                        >
                          <option value="CHF">CHF</option>
                          <option value="EUR">EUR</option>
                          <option value="USD">USD</option>
                          <option value="GBP">GBP</option>
                        </select>
                      </div>

                      <label 
                        className="flex-1 flex items-center justify-center px-6 py-2 border-2 border-dashed border-ypsom-alice hover:bg-ypsom-alice/20 rounded-sm cursor-pointer transition-all h-10"
                      >
                          <Upload className="w-3 h-3 mr-2 text-ypsom-slate" />
                          <span className="text-[11px] font-black uppercase tracking-widest text-ypsom-slate">
                            Click or drag statement here
                          </span>
                          <input type="file" className="hidden" accept="application/pdf" multiple onChange={handleFileUpload} />
                      </label>
                    </div>
                </div>

                <div className="w-full md:w-64 flex flex-col gap-3">
                    <div className="bg-gray-50 p-4 rounded-sm border border-ypsom-alice flex flex-col">
                        <div className="flex justify-between mb-2">
                           <p className="text-[10px] text-ypsom-slate uppercase font-black">Audit Evidence</p>
                           <p className="text-sm font-bold text-ypsom-deep">{supportingInvoices.length} Files</p>
                        </div>
                        <div className="flex justify-between">
                           <p className="text-[10px] text-ypsom-slate uppercase font-black">Pending Queue</p>
                           <p className="text-sm font-bold text-ypsom-slate">{stats.pending + stats.errors}</p>
                        </div>
                    </div>
                    <button onClick={processQueue} disabled={isProcessing || (stats.pending === 0 && stats.errors === 0)} className="w-full bg-ypsom-deep text-white px-4 py-3 rounded-sm font-bold text-xs uppercase tracking-widest shadow-md hover:bg-ypsom-shadow disabled:opacity-50 flex items-center justify-center">
                        <RefreshCcw className={`w-4 h-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} /> Run Audit & Link
                    </button>
                </div>
            </div>

            {(isProcessing || stats.progress > 0) && stats.total > 0 && (
                <div className="w-full space-y-2">
                    <div className="flex justify-between text-[9px] font-black text-ypsom-slate uppercase tracking-wider">
                        <span>Reconciliation Progress</span>
                        <span>{Math.round(stats.progress)}%</span>
                    </div>
                    <div className="w-full h-1 bg-ypsom-alice rounded-full overflow-hidden">
                        <div className="h-full bg-ypsom-deep transition-all duration-700 ease-out" style={{ width: `${stats.progress}%` }} />
                    </div>
                </div>
            )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 space-y-4">
                <div className="bg-white rounded-sm shadow-sm border border-ypsom-alice h-fit max-h-[400px] overflow-y-auto">
                    <div className="p-4 bg-gray-50 border-b border-ypsom-alice font-bold text-[10px] text-ypsom-slate uppercase tracking-[0.2em]">
                       Statements Ledger
                    </div>
                    <ul className="divide-y divide-ypsom-alice">
                        {statements.map(file => (
                            <li 
                                key={file.id} 
                                onClick={() => setSelectedStatementId(file.id)}
                                className={`p-4 text-xs flex flex-col cursor-pointer transition-all ${
                                    selectedStatementId === file.id ? 'bg-ypsom-alice/40 border-l-4 border-ypsom-deep pl-3' : 'hover:bg-gray-50 border-l-4 border-transparent'
                                } ${file.status === 'error' ? 'bg-red-50' : ''}`}
                            >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-ypsom-shadow truncate max-w-[140px]">{file.fileName}</span>
                                  {file.status === 'error' && <AlertTriangle className="w-3 h-3 text-red-600" />}
                                  {file.status === 'completed' && <CheckCircle className="w-3 h-3 text-green-600" />}
                                </div>
                                <span className={`text-[9px] uppercase font-black mt-1 ${file.status === 'error' ? 'text-red-700' : 'text-ypsom-slate'}`}>
                                  {file.status === 'error' ? 'Extraction Failed' : (file.data?.period || file.status.toUpperCase())}
                                </span>
                                {file.status === 'error' && !isProcessing && (
                                  <button onClick={(e) => { e.stopPropagation(); removeFile(file.id); }} className="mt-2 text-[8px] text-red-600 font-bold uppercase tracking-widest text-left">Remove & Replace</button>
                                )}
                            </li>
                        ))}
                        {statements.length === 0 && <li className="p-8 text-[9px] text-center text-ypsom-slate italic">No statements uploaded.</li>}
                    </ul>
                </div>

                <div className="bg-white rounded-sm shadow-sm border border-ypsom-alice h-fit max-h-[400px] overflow-y-auto">
                    <div className="p-4 bg-gray-50 border-b border-ypsom-alice font-bold text-[10px] text-ypsom-slate uppercase tracking-[0.2em] flex justify-between">
                       Available Evidence
                       <span className="bg-ypsom-deep text-white px-1.5 rounded-full text-[8px]">{supportingInvoices.length}</span>
                    </div>
                    <ul className="divide-y divide-ypsom-alice">
                        {supportingInvoices.map((inv, idx) => (
                            <li key={idx} className="p-3 text-[10px] flex items-center justify-between group hover:bg-gray-50">
                                <div className="flex flex-col">
                                    <span className="font-bold text-ypsom-deep truncate max-w-[120px]">{inv.issuer}</span>
                                    <span className="text-ypsom-slate">{inv.totalAmount.toFixed(2)} {inv.originalCurrency}</span>
                                </div>
                                <FileCheck className="w-3 h-3 text-ypsom-alice group-hover:text-ypsom-deep opacity-50" />
                            </li>
                        ))}
                        {supportingInvoices.length === 0 && <li className="p-8 text-[9px] text-center text-ypsom-slate italic">Upload invoices first to enable auto-linking.</li>}
                    </ul>
                </div>
            </div>

            <div className="lg:col-span-3">
                {activeStatement && activeStatement.status === 'completed' && activeStatement.data ? (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white p-5 rounded-sm shadow-sm border-t-4 border-green-500">
                                <p className="text-[10px] font-black text-ypsom-slate uppercase tracking-wider mb-2">Audit Income</p>
                                <p className="text-xl font-bold text-green-700 font-mono">
                                  {activeStatement.data.calculatedTotalIncome?.toLocaleString('en-CH', {minimumFractionDigits: 2})}
                                </p>
                            </div>
                            <div className="bg-white p-5 rounded-sm shadow-sm border-t-4 border-red-500">
                                <p className="text-[10px] font-black text-ypsom-slate uppercase tracking-wider mb-2">Audit Expenses</p>
                                <p className="text-xl font-bold text-red-700 font-mono">
                                  {activeStatement.data.calculatedTotalExpense?.toLocaleString('en-CH', {minimumFractionDigits: 2})}
                                </p>
                            </div>
                            <div className="bg-white p-5 rounded-sm shadow-sm border-t-4 border-ypsom-deep">
                                <p className="text-[10px] font-black text-ypsom-slate uppercase tracking-wider mb-2">Total Transactions</p>
                                <p className="text-xl font-bold text-ypsom-deep font-mono">
                                  {activeStatement.data.transactions.length}
                                </p>
                            </div>
                            <div className="bg-white p-5 rounded-sm shadow-sm border-t-4 border-blue-500">
                                <p className="text-[10px] font-black text-ypsom-slate uppercase tracking-wider mb-2">Reconciled</p>
                                <p className="text-xl font-bold text-blue-700 font-mono">
                                  {reconciledCount} / {activeStatement.data.transactions.length}
                                </p>
                            </div>
                        </div>

                        <div className="bg-white rounded-sm shadow-sm border border-ypsom-alice overflow-hidden">
                            <div className="px-6 py-4 border-b border-ypsom-alice bg-gray-50 flex justify-between items-center sticky top-0 z-10">
                                <h3 className="font-bold text-ypsom-deep text-sm flex items-center">
                                  <FileSpreadsheet className="w-4 h-4 mr-2" /> Reconciled Transaction Ledger
                                </h3>
                                <button onClick={() => exportToExcel(activeStatement.data!, activeStatement.fileName)} className="text-[10px] font-black uppercase text-ypsom-deep flex items-center bg-white px-4 py-2 rounded-sm border border-ypsom-alice shadow-sm hover:bg-gray-50 transition-colors">
                                    <Download className="w-3 h-3 mr-2" /> Export Audit Trail (.xlsx)
                                </button>
                            </div>
                            <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
                              <table className="min-w-full divide-y divide-ypsom-alice text-xs relative">
                                  <thead className="bg-ypsom-alice/10 sticky top-0 z-10 backdrop-blur-sm">
                                      <tr className="font-bold text-ypsom-deep uppercase text-[10px] tracking-wider">
                                          <th className="px-4 py-4 text-left w-24">Date</th>
                                          <th className="px-4 py-4 text-left">Description</th>
                                          <th className="px-4 py-4 text-left w-24">Audit Status</th>
                                          <th className="px-4 py-4 text-right w-24">Amount</th>
                                          <th className="px-4 py-4 text-left w-48">Evidence / Notes</th>
                                      </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-ypsom-alice">
                                      {activeStatement.data.transactions.map((t, idx) => (
                                          <tr key={idx} className={`hover:bg-ypsom-alice/5 transition-colors ${t.notes?.startsWith('Verified') ? 'bg-green-50/30' : ''}`}>
                                              <td className="px-4 py-3 font-mono">{t.date}</td>
                                              <td className="px-4 py-3">
                                                  <p className="font-bold text-ypsom-deep">{t.description}</p>
                                                  <p className="text-[9px] uppercase text-ypsom-slate">{t.category || 'Uncategorized'}</p>
                                              </td>
                                              <td className="px-4 py-3">
                                                  {t.notes?.startsWith('Verified') ? (
                                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black bg-green-100 text-green-800 uppercase">
                                                          <Link className="w-2.5 h-2.5 mr-1" /> Verified
                                                      </span>
                                                  ) : (
                                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-800 uppercase">
                                                          Pending
                                                      </span>
                                                  )}
                                              </td>
                                              <td className={`px-4 py-3 text-right font-mono text-xs font-bold ${t.type === 'INCOME' ? 'text-green-700' : 'text-red-600'}`}>
                                                {t.amount.toLocaleString('en-CH', {minimumFractionDigits: 2})}
                                              </td>
                                              <td className="px-4 py-3 text-[10px] text-ypsom-slate italic truncate max-w-xs" title={t.notes}>
                                                  {t.notes || '--'}
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                            </div>
                        </div>
                    </div>
                ) : activeStatement && activeStatement.status === 'error' ? (
                  <div className="h-[500px] flex flex-col items-center justify-center bg-red-50 border-2 border-dashed border-red-200 rounded-sm text-red-800 p-8 text-center">
                      <XCircle className="w-12 h-12 text-red-600 mb-4" />
                      <p className="text-lg font-bold">Extraction Failed for {activeStatement.fileName}</p>
                      <p className="text-sm mt-2 max-w-md">{activeStatement.error || "The system could not detect any financial transactions. This usually happens if the scan is blurry or the document layout is non-standard."}</p>
                      <button onClick={() => removeFile(activeStatement.id)} className="mt-6 bg-red-600 text-white px-8 py-3 rounded-sm font-bold text-xs uppercase tracking-widest shadow-md">Remove & Try Again with a better photo</button>
                  </div>
                ) : (
                    <div className="h-[500px] flex flex-col items-center justify-center bg-gray-100/30 border-2 border-dashed border-ypsom-alice rounded-sm text-ypsom-slate">
                        <Search className="w-10 h-10 opacity-20 mb-4" />
                        <p className="text-sm font-bold">Audit Reconciliation Dashboard</p>
                        <p className="text-xs mt-1 opacity-60 text-center max-w-[200px]">Run statement analysis to see automated linking with audit evidence.</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
