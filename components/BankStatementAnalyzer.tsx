import React, { useState } from 'react';
import { Upload, FileText, Loader2, CheckCircle, XCircle, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { analyzeBankStatement } from '../services/geminiService';
import { ProcessedBankStatement, BankStatementAnalysis } from '../types';
import * as XLSX from 'xlsx';

export const BankStatementAnalyzer: React.FC = () => {
  const [statements, setStatements] = useState<ProcessedBankStatement[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);

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
    const pending = statements.filter(s => s.status === 'pending' || s.status === 'error');

    for (const doc of pending) {
        if (!doc.fileRaw) continue;

        setStatements(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'processing', error: undefined } : d));

        try {
            const result = await analyzeBankStatement(doc.fileRaw);
            
            // Client-side Math for Accuracy
            const income = result.transactions
                .filter(t => t.type === 'INCOME')
                .reduce((acc, t) => acc + t.amount, 0);
            
            const expense = result.transactions
                .filter(t => t.type === 'EXPENSE')
                .reduce((acc, t) => acc + t.amount, 0);

            const enrichedResult: BankStatementAnalysis = {
                ...result,
                calculatedTotalIncome: income,
                calculatedTotalExpense: expense
            };

            setStatements(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'completed', data: enrichedResult } : d));
            if (!selectedStatementId) setSelectedStatementId(doc.id);
        } catch (err: any) {
            setStatements(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'error', error: err.message || "Failed" } : d));
        }
    }
    setIsProcessing(false);
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

    // Add Summary Row
    rows.push({} as any); 
    rows.push({ Description: 'TOTAL INCOME', Amount: data.calculatedTotalIncome } as any);
    rows.push({ Description: 'TOTAL EXPENSE', Amount: data.calculatedTotalExpense } as any);
    rows.push({ Description: 'NET FLOW', Amount: (data.calculatedTotalIncome || 0) - (data.calculatedTotalExpense || 0) } as any);

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
    XLSX.writeFile(workbook, `Statement_${fileName}.xlsx`);
  };

  const activeStatement = statements.find(s => s.id === selectedStatementId);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
        {/* Header / Upload Section */}
        <div className="bg-white p-6 rounded-sm shadow-sm border border-ypsom-alice flex flex-col md:flex-row gap-6">
            <div className="flex-1">
                 <h2 className="text-xl font-bold text-ypsom-deep mb-2 flex items-center">
                    <Wallet className="w-6 h-6 mr-2 text-ypsom-deep" />
                    Bank Statement Analyzer
                 </h2>
                 <p className="text-sm text-ypsom-slate mb-4">
                    Specialized tool for multi-page statements. Identifies line items, separates Income/Expense, and calculates totals automatically.
                 </p>
                 
                 <label className="flex items-center justify-center w-full md:w-auto px-6 py-3 border-2 border-dashed border-ypsom-alice rounded-sm cursor-pointer hover:bg-ypsom-alice/20 transition-colors">
                     <Upload className="w-4 h-4 mr-2 text-ypsom-slate" />
                     <span className="text-sm font-medium text-ypsom-shadow">Upload Statement (PDF)</span>
                     <input type="file" className="hidden" accept="application/pdf" multiple onChange={handleFileUpload} />
                 </label>
            </div>
            
            <div className="w-full md:w-64 flex flex-col gap-3">
                 <div className="bg-gray-50 p-3 rounded-sm border border-ypsom-alice">
                    <div className="text-xs text-ypsom-slate uppercase font-bold">Files Queued</div>
                    <div className="text-xl font-bold text-ypsom-deep">{statements.length}</div>
                 </div>
                 <button 
                    onClick={processQueue}
                    disabled={isProcessing || statements.length === 0}
                    className={`flex items-center justify-center px-4 py-2 rounded-sm text-white font-medium text-sm transition-all shadow-sm ${
                        isProcessing || statements.length === 0 ? 'bg-ypsom-slate opacity-70' : 'bg-ypsom-deep hover:bg-ypsom-shadow'
                    }`}
                 >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Process Statements"}
                 </button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar List */}
            <div className="lg:col-span-1 bg-white rounded-sm shadow-sm border border-ypsom-alice h-fit max-h-[600px] overflow-y-auto">
                <div className="p-3 bg-gray-50 border-b border-ypsom-alice font-bold text-xs text-ypsom-slate uppercase">
                    Your Files
                </div>
                {statements.length === 0 && <div className="p-4 text-xs text-ypsom-slate text-center">No files uploaded.</div>}
                <ul className="divide-y divide-ypsom-alice">
                    {statements.map(file => (
                        <li 
                            key={file.id} 
                            onClick={() => file.status === 'completed' && setSelectedStatementId(file.id)}
                            className={`p-3 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                                selectedStatementId === file.id ? 'bg-ypsom-alice/40 border-l-4 border-ypsom-deep' : 'hover:bg-gray-50 border-l-4 border-transparent'
                            }`}
                        >
                            <div className="truncate pr-2">
                                <div className="font-medium text-ypsom-shadow truncate">{file.fileName}</div>
                                <div className="text-[10px] text-ypsom-slate mt-0.5">{file.status}</div>
                            </div>
                            {file.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />}
                            {file.status === 'processing' && <Loader2 className="w-4 h-4 text-ypsom-deep animate-spin flex-shrink-0" />}
                            {file.status === 'error' && <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />}
                        </li>
                    ))}
                </ul>
            </div>

            {/* Main Content Detail */}
            <div className="lg:col-span-3">
                {activeStatement && activeStatement.data ? (
                    <div className="space-y-4">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-sm shadow-sm border-t-4 border-green-500">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-[10px] font-bold text-ypsom-slate uppercase">Total Income</p>
                                        <p className="text-xl font-bold text-green-700 font-mono">
                                            {activeStatement.data.calculatedTotalIncome?.toFixed(2)} <span className="text-xs">{activeStatement.data.currency}</span>
                                        </p>
                                    </div>
                                    <div className="bg-green-100 p-1.5 rounded-full"><TrendingUp className="w-4 h-4 text-green-700" /></div>
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-sm shadow-sm border-t-4 border-red-500">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-[10px] font-bold text-ypsom-slate uppercase">Total Expense</p>
                                        <p className="text-xl font-bold text-red-700 font-mono">
                                            {activeStatement.data.calculatedTotalExpense?.toFixed(2)} <span className="text-xs">{activeStatement.data.currency}</span>
                                        </p>
                                    </div>
                                    <div className="bg-red-100 p-1.5 rounded-full"><TrendingDown className="w-4 h-4 text-red-700" /></div>
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-sm shadow-sm border-t-4 border-ypsom-deep">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-[10px] font-bold text-ypsom-slate uppercase">Net Flow</p>
                                        <p className={`text-xl font-bold font-mono ${(activeStatement.data.calculatedTotalIncome || 0) - (activeStatement.data.calculatedTotalExpense || 0) >= 0 ? 'text-ypsom-deep' : 'text-red-600'}`}>
                                            {((activeStatement.data.calculatedTotalIncome || 0) - (activeStatement.data.calculatedTotalExpense || 0)).toFixed(2)}
                                        </p>
                                    </div>
                                    <div className="bg-gray-100 p-1.5 rounded-full"><Wallet className="w-4 h-4 text-ypsom-deep" /></div>
                                </div>
                            </div>
                        </div>

                        {/* Transaction List */}
                        <div className="bg-white rounded-sm shadow-sm border border-ypsom-alice overflow-hidden">
                            <div className="px-6 py-4 border-b border-ypsom-alice bg-gray-50 flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-ypsom-deep text-sm">Transactions</h3>
                                    <p className="text-xs text-ypsom-slate">Period: {activeStatement.data.period} | Holder: {activeStatement.data.accountHolder}</p>
                                </div>
                                <button 
                                    onClick={() => exportToExcel(activeStatement.data!, activeStatement.fileName)}
                                    className="text-xs font-bold text-ypsom-deep hover:underline flex items-center"
                                >
                                    Download Excel
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-ypsom-alice text-xs">
                                    <thead className="bg-ypsom-alice/30">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-bold text-ypsom-deep">Date</th>
                                            <th className="px-4 py-3 text-left font-bold text-ypsom-deep">Description</th>
                                            <th className="px-4 py-3 text-left font-bold text-ypsom-deep">Category</th>
                                            <th className="px-4 py-3 text-right font-bold text-ypsom-deep">Income</th>
                                            <th className="px-4 py-3 text-right font-bold text-ypsom-deep">Expense</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-ypsom-alice">
                                        {activeStatement.data.transactions.map((t, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 whitespace-nowrap text-ypsom-slate">{t.date}</td>
                                                <td className="px-4 py-3 text-ypsom-shadow font-medium max-w-xs truncate" title={t.description}>{t.description}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-ypsom-slate">
                                                    <span className="bg-gray-100 px-2 py-0.5 rounded-full text-[10px]">{t.category || 'Uncategorized'}</span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right font-mono text-green-700">
                                                    {t.type === 'INCOME' ? `+${t.amount.toFixed(2)}` : ''}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right font-mono text-red-600">
                                                    {t.type === 'EXPENSE' ? `-${t.amount.toFixed(2)}` : ''}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-ypsom-alice rounded-sm text-ypsom-slate">
                        <FileText className="w-12 h-12 mb-4 opacity-20" />
                        <p>Select a processed statement to view details.</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
