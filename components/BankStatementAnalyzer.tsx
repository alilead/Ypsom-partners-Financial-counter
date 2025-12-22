
import React, { useState, useRef, useMemo } from 'react';
import { Upload, FileText, Loader2, CheckCircle, XCircle, Wallet, StopCircle, RefreshCcw, Download, Coins, Plus, Trash2, Save, Edit3 } from 'lucide-react';
import { analyzeBankStatement } from '../services/geminiService';
import { ProcessedBankStatement, BankStatementAnalysis, BankTransaction } from '../types';
import * as XLSX from 'xlsx';

export const BankStatementAnalyzer: React.FC = () => {
  const [statements, setStatements] = useState<ProcessedBankStatement[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [reportingCurrency, setReportingCurrency] = useState('CHF');
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const stopProcessingRef = useRef(false);

  const stats = useMemo(() => {
    const total = statements.length;
    const completed = statements.filter(s => s.status === 'completed').length;
    const pending = statements.filter(s => s.status === 'pending').length;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    return { total, pending, progress };
  }, [statements]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files).map((file: File) => ({
        id: Math.random().toString(36).substr(2, 9),
        fileName: file.name,
        status: 'pending' as const,
        fileRaw: file
      }));
      setStatements(prev => [...prev, ...newFiles]);
    }
  };

  const processQueue = async () => {
    setIsProcessing(true);
    stopProcessingRef.current = false;
    
    const pendingIndices = statements
      .map((s, i) => s.status !== 'completed' ? i : -1)
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
          setStatements(prev => prev.map((d, i) => i === index ? { ...d, status: 'error', error: err.message || "Failed" } : d));
      }
    }
    setIsProcessing(false);
  };

  const handleStop = () => {
    stopProcessingRef.current = true;
    setIsProcessing(false);
  };

  const updateTransaction = (statementId: string, index: number, field: keyof BankTransaction, value: any) => {
    setStatements(prev => prev.map(s => {
      if (s.id !== statementId || !s.data) return s;
      const newTransactions = [...s.data.transactions];
      newTransactions[index] = { ...newTransactions[index], [field]: value };
      
      // Re-calculate totals
      const income = newTransactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
      const expense = newTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
      
      return { 
        ...s, 
        data: { 
          ...s.data, 
          transactions: newTransactions,
          calculatedTotalIncome: income,
          calculatedTotalExpense: expense
        } 
      };
    }));
  };

  const addTransaction = (statementId: string) => {
    setStatements(prev => prev.map(s => {
      if (s.id !== statementId || !s.data) return s;
      const newTransaction: BankTransaction = {
        date: new Date().toISOString().split('T')[0],
        description: 'New Transaction',
        amount: 0,
        type: 'EXPENSE',
        category: 'Uncategorized'
      };
      return { 
        ...s, 
        data: { 
          ...s.data, 
          transactions: [newTransaction, ...s.data.transactions] 
        } 
      };
    }));
  };

  const deleteTransaction = (statementId: string, index: number) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    setStatements(prev => prev.map(s => {
      if (s.id !== statementId || !s.data) return s;
      const newTransactions = s.data.transactions.filter((_, i) => i !== index);
      
      const income = newTransactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
      const expense = newTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

      return { 
        ...s, 
        data: { 
          ...s.data, 
          transactions: newTransactions,
          calculatedTotalIncome: income,
          calculatedTotalExpense: expense
        } 
      };
    }));
  };

  const exportToExcel = (data: BankStatementAnalysis, fileName: string) => {
    const rows = data.transactions.map(t => ({
        Date: t.date,
        Description: t.description,
        Type: t.type,
        Amount: t.amount,
        Category: t.category,
        Currency: data.currency
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
    XLSX.writeFile(workbook, `Statement_${fileName}.xlsx`);
  };

  const activeStatement = statements.find(s => s.id === selectedStatementId);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
        <div className="bg-white p-6 rounded-sm shadow-sm border border-ypsom-alice flex flex-col gap-6">
            <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-ypsom-deep mb-2 flex items-center">
                        <Wallet className="w-6 h-6 mr-2 text-ypsom-deep" />
                        Bank Statement Analyzer
                    </h2>
                    <p className="text-sm text-ypsom-slate mb-4">
                        Extract and reconcile bank transactions. You can manually edit any value below after processing.
                    </p>
                    
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                      <div className="w-full md:w-48">
                        <label className="block text-[10px] font-bold text-ypsom-slate uppercase tracking-wider mb-2">Reporting Currency</label>
                        <div className="relative">
                          <select 
                            value={reportingCurrency}
                            onChange={(e) => setReportingCurrency(e.target.value)}
                            disabled={isProcessing}
                            className="w-full pl-8 pr-3 py-2 border border-ypsom-alice rounded-sm bg-white text-sm font-bold text-ypsom-deep appearance-none"
                          >
                            <option value="CHF">CHF</option>
                            <option value="EUR">EUR</option>
                            <option value="USD">USD</option>
                            <option value="GBP">GBP</option>
                          </select>
                          <Coins className="w-4 h-4 text-ypsom-slate absolute left-2.5 top-2.5" />
                        </div>
                      </div>

                      <label className="flex-1 flex items-center justify-center px-6 py-2 border-2 border-dashed border-ypsom-alice rounded-sm cursor-pointer hover:bg-ypsom-alice/20 transition-colors h-10">
                          <Upload className="w-3 h-3 mr-2 text-ypsom-slate" />
                          <span className="text-xs font-medium text-ypsom-shadow">Upload Statement (PDF)</span>
                          <input type="file" className="hidden" accept="application/pdf" multiple onChange={handleFileUpload} />
                      </label>
                    </div>
                </div>
                <div className="w-full md:w-64 flex flex-col gap-3">
                    <div className="bg-gray-50 p-4 rounded-sm border border-ypsom-alice flex justify-between">
                        <div>
                           <p className="text-[10px] text-ypsom-slate uppercase font-black">Queued</p>
                           <p className="text-xl font-bold text-ypsom-deep">{stats.total}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] text-ypsom-slate uppercase font-black">Remaining</p>
                           <p className="text-xl font-bold text-ypsom-slate">{stats.pending}</p>
                        </div>
                    </div>
                    {isProcessing ? (
                        <button onClick={handleStop} className="w-full bg-red-600 text-white px-4 py-3 rounded-sm font-bold text-sm shadow-md hover:bg-red-700 transition-all flex items-center justify-center">
                            <StopCircle className="w-4 h-4 mr-2" /> Stop
                        </button>
                    ) : (
                        <button onClick={processQueue} disabled={stats.pending === 0} className="w-full bg-ypsom-deep text-white px-4 py-3 rounded-sm font-bold text-sm shadow-md hover:bg-ypsom-shadow transition-all disabled:opacity-50 flex items-center justify-center">
                            <RefreshCcw className="w-4 h-4 mr-2" /> Start Processing
                        </button>
                    )}
                </div>
            </div>

            {(isProcessing || stats.progress > 0) && stats.total > 0 && (
                <div className="w-full h-1.5 bg-ypsom-alice rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-ypsom-deep transition-all duration-500"
                        style={{ width: `${stats.progress}%` }}
                    />
                </div>
            )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 bg-white rounded-sm shadow-sm border border-ypsom-alice h-fit max-h-[600px] overflow-y-auto">
                <div className="p-3 bg-gray-50 border-b border-ypsom-alice font-bold text-xs text-ypsom-slate uppercase tracking-wider">Statement Queue</div>
                <ul className="divide-y divide-ypsom-alice">
                    {statements.length === 0 ? (
                      <li className="p-4 text-[10px] text-ypsom-slate text-center italic">No files uploaded.</li>
                    ) : statements.map(file => (
                        <li 
                            key={file.id} 
                            onClick={() => file.status === 'completed' && setSelectedStatementId(file.id)}
                            className={`p-3 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                                selectedStatementId === file.id ? 'bg-ypsom-alice/40 border-l-4 border-ypsom-deep' : 'hover:bg-gray-50 border-l-4 border-transparent'
                            }`}
                        >
                            <div className="truncate pr-2">
                                <div className="font-medium text-ypsom-shadow truncate">{file.fileName}</div>
                                <div className="text-[9px] uppercase tracking-tighter text-ypsom-slate mt-0.5">{file.status}</div>
                            </div>
                            {file.status === 'completed' && <CheckCircle className="w-3 h-3 text-green-600" />}
                            {file.status === 'processing' && <Loader2 className="w-3 h-3 text-ypsom-deep animate-spin" />}
                            {file.status === 'error' && <XCircle className="w-3 h-3 text-red-600" />}
                        </li>
                    ))}
                </ul>
            </div>

            <div className="lg:col-span-3">
                {activeStatement && activeStatement.data ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-sm shadow-sm border-t-4 border-green-500">
                                <p className="text-[10px] font-bold text-ypsom-slate uppercase">Income ({activeStatement.data.currency})</p>
                                <p className="text-xl font-bold text-green-700 font-mono">+{activeStatement.data.calculatedTotalIncome?.toFixed(2)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-sm shadow-sm border-t-4 border-red-500">
                                <p className="text-[10px] font-bold text-ypsom-slate uppercase">Expense ({activeStatement.data.currency})</p>
                                <p className="text-xl font-bold text-red-700 font-mono">-{activeStatement.data.calculatedTotalExpense?.toFixed(2)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-sm shadow-sm border-t-4 border-ypsom-deep">
                                <p className="text-[10px] font-bold text-ypsom-slate uppercase">Net (Original)</p>
                                <p className="text-xl font-bold font-mono">{(activeStatement.data.calculatedTotalIncome! - activeStatement.data.calculatedTotalExpense!).toFixed(2)}</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-sm shadow-sm border border-ypsom-alice overflow-hidden">
                            <div className="px-6 py-4 border-b border-ypsom-alice bg-gray-50 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                  <h3 className="font-bold text-ypsom-deep text-sm">Ledger Detail</h3>
                                  <button 
                                    onClick={() => addTransaction(activeStatement.id)}
                                    className="text-[10px] font-bold text-white bg-ypsom-deep px-3 py-1.5 rounded flex items-center hover:bg-ypsom-shadow"
                                  >
                                    <Plus className="w-3 h-3 mr-1" /> Add Entry
                                  </button>
                                </div>
                                <button onClick={() => exportToExcel(activeStatement.data!, activeStatement.fileName)} className="text-[10px] font-black uppercase text-ypsom-deep flex items-center bg-white px-3 py-1.5 rounded border border-ypsom-alice hover:bg-gray-50">
                                    <Download className="w-3 h-3 mr-1" /> Download Excel
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-ypsom-alice text-xs">
                                  <thead className="bg-ypsom-alice/20">
                                      <tr className="font-bold text-ypsom-deep uppercase text-[10px]">
                                          <th className="px-4 py-3 text-left w-32">Date</th>
                                          <th className="px-4 py-3 text-left">Description</th>
                                          <th className="px-4 py-3 text-left w-24">Type</th>
                                          <th className="px-4 py-3 text-right w-32">Amount</th>
                                          <th className="px-4 py-3 text-center w-16">Actions</th>
                                      </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-ypsom-alice">
                                      {activeStatement.data.transactions.map((t, idx) => (
                                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                              <td className="px-4 py-2">
                                                  <input 
                                                    type="date"
                                                    value={t.date}
                                                    onChange={(e) => updateTransaction(activeStatement.id, idx, 'date', e.target.value)}
                                                    className="w-full bg-transparent border-none focus:ring-1 focus:ring-ypsom-deep rounded px-1 font-mono text-xs"
                                                  />
                                              </td>
                                              <td className="px-4 py-2">
                                                  <input 
                                                    type="text"
                                                    value={t.description}
                                                    onChange={(e) => updateTransaction(activeStatement.id, idx, 'description', e.target.value)}
                                                    className="w-full bg-transparent border-none focus:ring-1 focus:ring-ypsom-deep rounded px-1 text-xs"
                                                  />
                                              </td>
                                              <td className="px-4 py-2">
                                                  <select
                                                    value={t.type}
                                                    onChange={(e) => updateTransaction(activeStatement.id, idx, 'type', e.target.value)}
                                                    className={`w-full bg-transparent border-none focus:ring-1 focus:ring-ypsom-deep rounded px-1 text-[10px] font-bold uppercase ${t.type === 'INCOME' ? 'text-green-700' : 'text-red-600'}`}
                                                  >
                                                    <option value="INCOME">Income</option>
                                                    <option value="EXPENSE">Expense</option>
                                                  </select>
                                              </td>
                                              <td className="px-4 py-2 text-right">
                                                  <input 
                                                    type="number"
                                                    value={t.amount}
                                                    step="0.01"
                                                    onChange={(e) => updateTransaction(activeStatement.id, idx, 'amount', parseFloat(e.target.value))}
                                                    className={`w-full bg-transparent border-none focus:ring-1 focus:ring-ypsom-deep rounded px-1 text-right font-mono text-xs font-bold ${t.type === 'INCOME' ? 'text-green-700' : 'text-red-600'}`}
                                                  />
                                              </td>
                                              <td className="px-4 py-2 text-center">
                                                  <button 
                                                    onClick={() => deleteTransaction(activeStatement.id, idx)}
                                                    className="text-ypsom-slate hover:text-red-600 transition-colors"
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </button>
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-[400px] flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-ypsom-alice rounded-sm text-ypsom-slate">
                        <FileText className="w-12 h-12 mb-4 opacity-10" />
                        <p className="text-sm font-medium">Select a statement to view and edit analysis.</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
