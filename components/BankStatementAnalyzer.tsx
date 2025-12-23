
import React, { useState, useRef, useMemo } from 'react';
import { Upload, FileText, Loader2, CheckCircle, XCircle, Wallet, StopCircle, RefreshCcw, Download, Coins, Plus, Trash2, ChevronRight, FileSpreadsheet, AlertTriangle, X } from 'lucide-react';
import { analyzeBankStatement } from '../services/geminiService';
import { ProcessedBankStatement, BankStatementAnalysis, BankTransaction } from '../types';
import * as XLSX from 'xlsx';

interface Notification {
  id: string;
  message: string;
  type: 'warning' | 'error' | 'success';
}

export const BankStatementAnalyzer: React.FC = () => {
  const [statements, setStatements] = useState<ProcessedBankStatement[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [reportingCurrency, setReportingCurrency] = useState('CHF');
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const stopProcessingRef = useRef(false);

  const stats = useMemo(() => {
    const total = statements.length;
    const completed = statements.filter(s => s.status === 'completed').length;
    const pending = statements.filter(s => s.status === 'pending').length;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    return { total, pending, progress };
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
          setStatements(prev => prev.map((d, i) => i === index ? { ...d, status: 'completed', data: result } : d));
          if (!selectedStatementId) setSelectedStatementId(doc.id);
      } catch (err: any) {
          console.error("Statement extraction error:", err);
          setStatements(prev => prev.map((d, i) => i === index ? { ...d, status: 'error', error: err.message } : d));
          addNotification(`Failed to process ${doc.fileName}`, 'error');
      }
    }
    setIsProcessing(false);
  };

  const exportToExcel = (data: BankStatementAnalysis, fileName: string) => {
    const rows = data.transactions.map(t => ({
        Date: t.date,
        Description: t.description,
        Type: t.type,
        'Amount': t.amount,
        Category: t.category || '',
        Currency: data.currency
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ledger");
    XLSX.writeFile(workbook, `Audit_${fileName.split('.')[0]}.xlsx`);
  };

  const activeStatement = statements.find(s => s.id === selectedStatementId);

  return (
    <div className="space-y-6 relative pb-12">
        {/* Toast Notifications */}
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
                        Exhaustive Statement Audit
                    </h2>
                    <p className="text-sm text-ypsom-slate mb-6">
                        System scans 30+ pages sequentially with high-precision historical exchange rates via Google Search.
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
                        className={`flex-1 flex items-center justify-center px-6 py-2 border-2 border-dashed rounded-sm cursor-pointer transition-all h-10 ${
                          isDragging ? 'border-ypsom-deep bg-ypsom-alice/40' : 'border-ypsom-alice hover:bg-ypsom-alice/20'
                        }`}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files)); }}
                      >
                          <Upload className="w-3 h-3 mr-2 text-ypsom-slate" />
                          <span className="text-[11px] font-black uppercase tracking-widest text-ypsom-slate">
                            {isDragging ? 'Drop PDF' : 'Upload Bank Statement (PDF)'}
                          </span>
                          <input type="file" className="hidden" accept="application/pdf" multiple onChange={handleFileUpload} />
                      </label>
                    </div>
                </div>

                <div className="w-full md:w-64 flex flex-col gap-3">
                    <div className="bg-gray-50 p-4 rounded-sm border border-ypsom-alice flex justify-between">
                        <div>
                           <p className="text-[10px] text-ypsom-slate uppercase font-black">Total Batch</p>
                           <p className="text-xl font-bold text-ypsom-deep">{statements.length}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] text-ypsom-slate uppercase font-black">Queued</p>
                           <p className="text-xl font-bold text-ypsom-slate">{stats.pending}</p>
                        </div>
                    </div>
                    <button onClick={processQueue} disabled={isProcessing || stats.pending === 0} className="w-full bg-ypsom-deep text-white px-4 py-3 rounded-sm font-bold text-xs uppercase tracking-widest shadow-md hover:bg-ypsom-shadow disabled:opacity-50 flex items-center justify-center">
                        <RefreshCcw className={`w-4 h-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} /> Run Analysis
                    </button>
                </div>
            </div>

            {/* Pending File Queue */}
            {statements.length > 0 && (
              <div className="pt-4 border-t border-ypsom-alice animate-in fade-in slide-in-from-top-2">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {statements.map(file => (
                    <div key={file.id} className={`p-2 px-3 rounded-sm border flex items-center justify-between text-[10px] ${
                      file.status === 'completed' ? 'bg-green-50 border-green-200' :
                      file.status === 'processing' ? 'bg-ypsom-alice/20 border-ypsom-alice border-dashed' :
                      file.status === 'error' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-ypsom-alice'
                    }`}>
                      <span className="font-bold truncate max-w-[120px]" title={file.fileName}>{file.fileName}</span>
                      {!isProcessing && file.status !== 'completed' && (
                        <button onClick={() => removeFile(file.id)} className="text-ypsom-slate hover:text-red-600 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                      {file.status === 'completed' && <CheckCircle className="w-3 h-3 text-green-600" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(isProcessing || stats.progress > 0) && stats.total > 0 && (
                <div className="w-full space-y-2">
                    <div className="flex justify-between text-[9px] font-black text-ypsom-slate uppercase tracking-wider">
                        <span>Analysis Progress</span>
                        <span>{Math.round(stats.progress)}%</span>
                    </div>
                    <div className="w-full h-1 bg-ypsom-alice rounded-full overflow-hidden">
                        <div className="h-full bg-ypsom-deep transition-all duration-700 ease-out" style={{ width: `${stats.progress}%` }} />
                    </div>
                </div>
            )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 bg-white rounded-sm shadow-sm border border-ypsom-alice h-fit max-h-[600px] overflow-y-auto sticky top-24">
                <div className="p-4 bg-gray-50 border-b border-ypsom-alice font-bold text-[10px] text-ypsom-slate uppercase tracking-[0.2em]">
                   Processed Statements
                </div>
                <ul className="divide-y divide-ypsom-alice">
                    {statements.filter(s => s.status === 'completed').map(file => (
                        <li 
                            key={file.id} 
                            onClick={() => setSelectedStatementId(file.id)}
                            className={`p-4 text-xs flex flex-col cursor-pointer transition-all ${
                                selectedStatementId === file.id ? 'bg-ypsom-alice/40 border-l-4 border-ypsom-deep pl-3' : 'hover:bg-gray-50 border-l-4 border-transparent'
                            }`}
                        >
                            <span className="font-bold text-ypsom-shadow truncate">{file.fileName}</span>
                            <span className="text-[9px] uppercase font-black text-ypsom-slate mt-1">{file.data?.period || 'Extracted'}</span>
                        </li>
                    ))}
                    {statements.filter(s => s.status === 'completed').length === 0 && <li className="p-8 text-[10px] text-ypsom-slate text-center italic opacity-50">No reports available</li>}
                </ul>
            </div>

            <div className="lg:col-span-3">
                {activeStatement && activeStatement.data ? (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-5 rounded-sm shadow-sm border-t-4 border-green-500">
                                <p className="text-[10px] font-black text-ypsom-slate uppercase tracking-wider mb-2">Audit Income</p>
                                <p className="text-2xl font-bold text-green-700 font-mono tracking-tighter">
                                  {activeStatement.data.calculatedTotalIncome?.toLocaleString('en-CH', {minimumFractionDigits: 2})} <span className="text-xs">{activeStatement.data.currency}</span>
                                </p>
                            </div>
                            <div className="bg-white p-5 rounded-sm shadow-sm border-t-4 border-red-500">
                                <p className="text-[10px] font-black text-ypsom-slate uppercase tracking-wider mb-2">Audit Expenses</p>
                                <p className="text-2xl font-bold text-red-700 font-mono tracking-tighter">
                                  {activeStatement.data.calculatedTotalExpense?.toLocaleString('en-CH', {minimumFractionDigits: 2})} <span className="text-xs">{activeStatement.data.currency}</span>
                                </p>
                            </div>
                            <div className="bg-white p-5 rounded-sm shadow-sm border-t-4 border-ypsom-deep">
                                <p className="text-[10px] font-black text-ypsom-slate uppercase tracking-wider mb-2">Net Cashflow</p>
                                <p className="text-2xl font-bold font-mono tracking-tighter text-ypsom-deep">
                                  {(activeStatement.data.calculatedTotalIncome! - activeStatement.data.calculatedTotalExpense!).toLocaleString('en-CH', {minimumFractionDigits: 2})}
                                </p>
                            </div>
                        </div>

                        <div className="bg-white rounded-sm shadow-sm border border-ypsom-alice overflow-hidden">
                            <div className="px-6 py-4 border-b border-ypsom-alice bg-gray-50 flex justify-between items-center sticky top-0 z-10">
                                <h3 className="font-bold text-ypsom-deep text-sm flex items-center">
                                  <FileSpreadsheet className="w-4 h-4 mr-2" /> Exhaustive Audit Ledger
                                </h3>
                                <button onClick={() => exportToExcel(activeStatement.data!, activeStatement.fileName)} className="text-[10px] font-black uppercase text-ypsom-deep flex items-center bg-white px-4 py-2 rounded-sm border border-ypsom-alice shadow-sm hover:bg-gray-50 transition-colors">
                                    <Download className="w-3 h-3 mr-2" /> Save to Excel (.xlsx)
                                </button>
                            </div>
                            <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
                              <table className="min-w-full divide-y divide-ypsom-alice text-xs relative">
                                  <thead className="bg-ypsom-alice/10 sticky top-0 z-10 backdrop-blur-sm">
                                      <tr className="font-bold text-ypsom-deep uppercase text-[10px] tracking-wider">
                                          <th className="px-4 py-4 text-left w-36">Date</th>
                                          <th className="px-4 py-4 text-left">Description</th>
                                          <th className="px-4 py-4 text-left w-24">Type</th>
                                          <th className="px-4 py-4 text-right w-32">Amount ({activeStatement.data.currency})</th>
                                      </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-ypsom-alice">
                                      {activeStatement.data.transactions.map((t, idx) => (
                                          <tr key={idx} className="hover:bg-ypsom-alice/5 transition-colors group">
                                              <td className="px-4 py-3 font-mono">{t.date}</td>
                                              <td className="px-4 py-3">{t.description}</td>
                                              <td className={`px-4 py-3 font-black text-[9px] uppercase ${t.type === 'INCOME' ? 'text-green-700' : 'text-red-600'}`}>{t.type}</td>
                                              <td className={`px-4 py-3 text-right font-mono text-xs font-bold ${t.type === 'INCOME' ? 'text-green-700' : 'text-red-600'}`}>
                                                {t.amount.toLocaleString('en-CH', {minimumFractionDigits: 2})}
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-[500px] flex flex-col items-center justify-center bg-gray-100/30 border-2 border-dashed border-ypsom-alice rounded-sm text-ypsom-slate">
                        <FileText className="w-10 h-10 opacity-20 mb-4" />
                        <p className="text-sm font-bold">Audit Dashboard</p>
                        <p className="text-xs mt-1 opacity-60 text-center max-w-[200px]">Run analysis to see detailed financial breakdowns and cashflow tracking.</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
