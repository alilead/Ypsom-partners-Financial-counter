
import React, { useState, useRef, useMemo } from 'react';
import { Upload, CheckCircle, Wallet, RefreshCcw, Download, Trash2, FileSpreadsheet, Search, FileCheck, XCircle, FileUp, Zap, Clock, Loader2, ArrowUpRight, ArrowDownRight, Activity, Ban } from 'lucide-react';
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
  const [isStopping, setIsStopping] = useState(false);
  const [reportingCurrency, setReportingCurrency] = useState('CHF');
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const dragCounter = useRef(0);
  const stopProcessingRef = useRef(false);

  const stats = useMemo(() => {
    const total = statements.length;
    const completed = statements.filter(s => s.status === 'completed').length;
    const pending = statements.filter(s => s.status === 'pending' || s.status === 'processing').length;
    const errors = statements.filter(s => s.status === 'error').length;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    
    const estRemainingSeconds = (statements.filter(s => s.status === 'pending').length * 20) / 3;
    const minutes = Math.floor(estRemainingSeconds / 60);
    const seconds = Math.floor(estRemainingSeconds % 60);

    return { total, pending, progress, errors, timeStr: `${minutes}m ${seconds}s` };
  }, [statements]);

  const addNotification = (message: string, type: 'warning' | 'error' | 'success' = 'warning') => {
    const id = Math.random().toString(36).substring(7);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
  };

  const removeFile = (id: string) => {
    if (isProcessing) return;
    setStatements(prev => prev.filter(s => s.id !== id));
  };

  const addFiles = (files: File[]) => {
    const newFiles: ProcessedBankStatement[] = Array.from(files).map(f => ({
      id: Math.random().toString(36).substr(2, 9),
      fileName: f.name,
      status: 'pending' as const,
      fileRaw: f
    }));
    setStatements(prev => [...prev, ...newFiles]);
  };

  const stopProcess = () => {
    stopProcessingRef.current = true;
    setIsStopping(true);
    addNotification("Halting reconciliation...", "warning");
  };

  const processQueue = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setIsStopping(false);
    stopProcessingRef.current = false;
    
    const pendingIndices = statements
      .map((s, i) => (s.status === 'pending' || s.status === 'error') ? i : -1)
      .filter(i => i !== -1);

    const CONCURRENCY_LIMIT = 3; 
    let indexInQueue = 0;
    const activeTasks = new Set<Promise<void>>();

    const runTask = async (idx: number) => {
      const doc = statements[idx];
      if (!doc.fileRaw) return;

      setStatements(prev => prev.map((d, i) => i === idx ? { ...d, status: 'processing', error: undefined } : d));

      try {
        const result = await analyzeBankStatement(doc.fileRaw, reportingCurrency);
        
        const reconciledTransactions = result.transactions.map(t => {
          const match = supportingInvoices.find(inv => Math.abs(inv.totalAmount - t.amount) < 0.05);
          if (match) return { ...t, notes: `Verified: ${match.issuer}`, category: match.expenseCategory };
          return t;
        });

        setStatements(prev => prev.map((d, i) => i === idx ? { ...d, status: 'completed', data: { ...result, transactions: reconciledTransactions } } : d));
        if (!selectedStatementId) setSelectedStatementId(doc.id);
      } catch (err: any) {
        setStatements(prev => prev.map((d, i) => i === idx ? { ...d, status: 'error', error: err.message } : d));
        addNotification(`${doc.fileName}: ${err.message}`, 'error');
      }
    };

    while (indexInQueue < pendingIndices.length && !stopProcessingRef.current) {
      while (activeTasks.size < CONCURRENCY_LIMIT && indexInQueue < pendingIndices.length && !stopProcessingRef.current) {
        const idx = pendingIndices[indexInQueue++];
        const task = runTask(idx).finally(() => activeTasks.delete(task));
        activeTasks.add(task);
      }
      if (activeTasks.size > 0) await Promise.race(activeTasks);
    }

    await Promise.all(activeTasks);
    setIsProcessing(false);
    setIsStopping(false);
  };

  const activeStatement = statements.find(s => s.id === selectedStatementId);
  
  const summary = useMemo(() => {
    if (!activeStatement?.data) return null;
    const income = activeStatement.data.calculatedTotalIncome || 0;
    const expense = activeStatement.data.calculatedTotalExpense || 0;
    const net = income - expense;
    const count = activeStatement.data.transactions.length;
    const opening = activeStatement.data.openingBalance || 0;
    const closing = opening + net;
    
    return { income, expense, net, count, opening, closing };
  }, [activeStatement]);

  return (
    <div 
      className={`space-y-6 relative transition-all duration-300 ${isDragging ? 'scale-[1.01]' : ''}`}
      onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setIsDragging(true); }}
      onDragLeave={() => { dragCounter.current--; if (dragCounter.current === 0) setIsDragging(false); }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files)); }}
    >
        <div className="bg-white p-6 rounded-sm shadow-sm border border-ypsom-alice space-y-6">
            <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-ypsom-deep mb-2 flex items-center"><Wallet className="w-6 h-6 mr-2" /> Reconciliation Workbench</h2>
                    <p className="text-sm text-ypsom-slate mb-6">Automated matching of bank entries with audit evidence.</p>
                    
                    <label className="flex items-center justify-center h-12 border-2 border-dashed border-ypsom-alice hover:bg-ypsom-alice/20 rounded-sm cursor-pointer transition-all">
                        <Upload className="w-4 h-4 mr-2 text-ypsom-slate" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-ypsom-slate">Upload Statements for Batch Linkage</span>
                        <input type="file" className="hidden" accept="application/pdf" multiple onChange={(e) => e.target.files && addFiles(Array.from(e.target.files))} />
                    </label>
                </div>

                <div className="w-full md:w-64 flex flex-col gap-3">
                    {isProcessing ? (
                      <button 
                        onClick={stopProcess}
                        disabled={isStopping}
                        className="w-full bg-red-600 text-white py-3 rounded-sm font-bold text-xs uppercase tracking-widest shadow-md flex items-center justify-center hover:bg-red-700 transition-colors"
                      >
                        <Ban className="w-4 h-4 mr-2" /> {isStopping ? 'Stopping...' : 'Stop Linking'}
                      </button>
                    ) : (
                      <button 
                        onClick={processQueue} 
                        disabled={stats.pending === 0} 
                        className="w-full bg-ypsom-deep text-white py-3 rounded-sm font-bold text-xs uppercase tracking-widest shadow-md flex items-center justify-center hover:bg-ypsom-shadow transition-colors"
                      >
                        <RefreshCcw className="w-4 h-4 mr-2" /> Run Parallel Linking
                      </button>
                    )}
                    {isProcessing && (
                      <div className="text-center">
                        <p className={`text-[9px] font-bold uppercase tracking-[0.2em] mb-1 ${isStopping ? 'text-red-500' : 'text-ypsom-deep'}`}>
                          {isStopping ? 'Draining Workers' : '3 Active Workers'}
                        </p>
                        {!isStopping && <p className="text-[8px] text-ypsom-slate font-medium">EST: {stats.timeStr}</p>}
                      </div>
                    )}
                </div>
            </div>

            {isProcessing && (
                <div className="w-full h-1 bg-ypsom-alice rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-700 ${isStopping ? 'bg-red-500' : 'bg-ypsom-deep'}`} style={{ width: `${stats.progress}%` }} />
                </div>
            )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 bg-white rounded-sm border border-ypsom-alice h-fit max-h-[600px] overflow-y-auto custom-scrollbar">
                <div className="p-4 bg-gray-50 border-b border-ypsom-alice font-bold text-[10px] text-ypsom-slate uppercase tracking-widest">Statement Queue</div>
                <ul className="divide-y divide-ypsom-alice">
                    {statements.map(s => (
                        <li key={s.id} onClick={() => setSelectedStatementId(s.id)} className={`p-4 cursor-pointer transition-colors flex justify-between items-center ${selectedStatementId === s.id ? 'bg-ypsom-alice/40 border-l-4 border-ypsom-deep pl-3' : 'hover:bg-gray-50'}`}>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-ypsom-shadow truncate max-w-[120px]">{s.fileName}</span>
                              <span className={`text-[9px] uppercase font-black mt-1 ${s.status === 'completed' ? 'text-green-600' : s.status === 'error' ? 'text-red-600' : 'text-ypsom-slate'}`}>{s.status}</span>
                            </div>
                            {s.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin text-ypsom-deep" />}
                        </li>
                    ))}
                </ul>
            </div>

            <div className="lg:col-span-3 space-y-6">
                {activeStatement && activeStatement.status === 'completed' && summary ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-sm border border-ypsom-alice shadow-sm flex flex-col justify-between h-28">
                                <div className="flex justify-between items-start">
                                    <span className="text-[9px] font-black text-ypsom-slate uppercase tracking-[0.15em]">Total Income</span>
                                    <ArrowUpRight className="w-3 h-3 text-green-500" />
                                </div>
                                <div>
                                    <p className="text-lg font-bold text-ypsom-deep font-mono leading-none">{summary.income.toFixed(2)}</p>
                                    <p className="text-[9px] text-ypsom-slate mt-1 font-bold">{activeStatement.data?.currency}</p>
                                </div>
                            </div>

                            <div className="bg-white p-4 rounded-sm border border-ypsom-alice shadow-sm flex flex-col justify-between h-28">
                                <div className="flex justify-between items-start">
                                    <span className="text-[9px] font-black text-ypsom-slate uppercase tracking-[0.15em]">Total Expenses</span>
                                    <ArrowDownRight className="w-3 h-3 text-red-500" />
                                </div>
                                <div>
                                    <p className="text-lg font-bold text-ypsom-deep font-mono leading-none">{summary.expense.toFixed(2)}</p>
                                    <p className="text-[9px] text-ypsom-slate mt-1 font-bold">{activeStatement.data?.currency}</p>
                                </div>
                            </div>

                            <div className={`p-4 rounded-sm border shadow-sm flex flex-col justify-between h-28 ${summary.net >= 0 ? 'bg-green-50/30 border-green-100' : 'bg-red-50/30 border-red-100'}`}>
                                <div className="flex justify-between items-start">
                                    <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${summary.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>Net Cash Flow</span>
                                    <Activity className={`w-3 h-3 ${summary.net >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                                </div>
                                <div>
                                    <p className={`text-lg font-bold font-mono leading-none ${summary.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                        {summary.net >= 0 ? '+' : ''}{summary.net.toFixed(2)}
                                    </p>
                                    <p className="text-[9px] text-ypsom-slate mt-1 font-bold">CALCULATED CLOSING</p>
                                </div>
                            </div>

                            <div className="bg-ypsom-deep p-4 rounded-sm border border-ypsom-deep shadow-sm flex flex-col justify-between h-28">
                                <div className="flex justify-between items-start">
                                    <span className="text-[9px] font-black text-white/60 uppercase tracking-[0.15em]">Statement Period</span>
                                    <Wallet className="w-3 h-3 text-white/40" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white truncate">{activeStatement.data?.period || 'N/A'}</p>
                                    <p className="text-[9px] text-white/60 mt-1 font-bold uppercase">{summary.count} TRANSACTIONS</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-sm shadow-sm border border-ypsom-alice overflow-hidden">
                            <div className="px-6 py-4 border-b border-ypsom-alice bg-gray-50 flex justify-between items-center">
                                <h3 className="font-bold text-ypsom-deep text-sm flex items-center"><FileSpreadsheet className="w-4 h-4 mr-2" /> Reconciled Transaction Ledger</h3>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-ypsom-alice text-xs">
                                  <thead className="bg-ypsom-alice/10">
                                      <tr className="font-bold text-ypsom-deep uppercase text-[9px] tracking-wider">
                                          <th className="px-4 py-4 text-left">Date</th>
                                          <th className="px-4 py-4 text-left">Description</th>
                                          <th className="px-4 py-4 text-right">Amount</th>
                                          <th className="px-4 py-4 text-left">Audit Linking</th>
                                      </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-ypsom-alice">
                                      {activeStatement.data!.transactions.map((t, idx) => (
                                          <tr key={idx} className={`hover:bg-ypsom-alice/5 transition-colors ${t.notes?.startsWith('Verified') ? 'bg-green-50/20' : ''}`}>
                                              <td className="px-4 py-3 font-mono text-ypsom-slate">{t.date}</td>
                                              <td className="px-4 py-3 font-bold text-ypsom-deep">{t.description}</td>
                                              <td className={`px-4 py-3 text-right font-mono font-bold ${t.type === 'INCOME' ? 'text-green-700' : 'text-red-600'}`}>
                                                {t.amount.toFixed(2)}
                                              </td>
                                              <td className="px-4 py-3 italic text-ypsom-slate">
                                                {t.notes ? (
                                                  <span className="flex items-center text-green-700 font-medium">
                                                    <CheckCircle className="w-3 h-3 mr-1.5" /> {t.notes}
                                                  </span>
                                                ) : (
                                                  <span className="opacity-40">No supporting doc linked</span>
                                                )}
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
                        <Search className="w-10 h-10 opacity-20 mb-4" />
                        <p className="text-xs font-bold uppercase tracking-widest">Select a completed statement</p>
                        <p className="text-[10px] mt-2 opacity-60">Analysis summary and linked evidence will appear here.</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
