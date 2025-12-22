
import React, { useState, useRef, useMemo } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Loader2, Download, RefreshCcw, Receipt, Landmark, FileDigit, PieChart, Sparkles, StopCircle, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Link as LinkIcon, AlertCircle, Coins } from 'lucide-react';
import { analyzeFinancialDocument, generateFinancialSummary, reconcileDocuments } from '../services/geminiService';
import { exportToExcel } from '../services/excelService';
import { ProcessedDocument, DocumentType, FinancialData, BankTransaction } from '../types';

export const DocumentProcessor: React.FC = () => {
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [reportingCurrency, setReportingCurrency] = useState('CHF');
  const [summary, setSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const stopProcessingRef = useRef(false);

  const stats = useMemo(() => {
    const total = documents.length;
    const completed = documents.filter(d => d.status === 'completed').length;
    const errors = documents.filter(d => d.status === 'error').length;
    const pending = documents.filter(d => d.status === 'pending').length;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    return { total, completed, errors, pending, progress };
  }, [documents]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files).map((file: File) => ({
        id: Math.random().toString(36).substr(2, 9), 
        fileName: file.name, 
        status: 'pending' as const, 
        fileRaw: file
      }));
      setDocuments(prev => [...prev, ...newFiles]);
      setSummary(null);
    }
  };

  const processAll = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    stopProcessingRef.current = false;
    
    const pendingIndices = documents
      .map((d, i) => d.status !== 'completed' ? i : -1)
      .filter(i => i !== -1);

    for (const index of pendingIndices) {
      if (stopProcessingRef.current) break;
      
      const doc = documents[index];
      if (!doc.fileRaw) continue;

      setDocuments(prev => prev.map((d, i) => i === index ? { ...d, status: 'processing' } : d));

      try {
        const result = await analyzeFinancialDocument(doc.fileRaw, reportingCurrency);
        setDocuments(prev => prev.map((d, i) => i === index ? { ...d, status: 'completed', data: result } : d));
        
        if (result.documentType === DocumentType.BANK_STATEMENT) {
          setExpandedDocs(prev => new Set(prev).add(doc.id));
        }
      } catch (err: any) {
        setDocuments(prev => prev.map((d, i) => i === index ? { ...d, status: 'error', error: err.message } : d));
      }
    }
    setIsProcessing(false);
  };

  const handleStop = () => {
    stopProcessingRef.current = true;
    setIsProcessing(false);
  };

  const handleReconcile = () => {
    const data = documents.filter(d => d.status === 'completed' && d.data).map(d => d.data!);
    const reconciled = reconcileDocuments(data);
    setDocuments(prev => prev.map(doc => {
      const match = reconciled.find(r => r.issuer === doc.data?.issuer && r.date === doc.data?.date);
      return match ? { ...doc, data: match } : doc;
    }));
  };

  const toggleExpand = (id: string) => {
    setExpandedDocs(prev => { 
      const next = new Set(prev); 
      if (next.has(id)) next.delete(id); else next.add(id); 
      return next; 
    });
  };

  const handleGenerateSummary = async () => {
    const data = documents.filter(d => d.status === 'completed' && d.data).map(d => d.data!);
    if (data.length === 0) return;
    setIsGeneratingSummary(true);
    try { 
      const text = await generateFinancialSummary(data, reportingCurrency); 
      setSummary(text); 
    } finally { 
      setIsGeneratingSummary(false); 
    }
  };

  const completed = documents.filter(d => d.status === 'completed' && d.data);
  const totalExpense = completed.reduce((acc, doc) => {
    if (doc.data?.documentType !== DocumentType.BANK_STATEMENT) {
      return acc + (doc.data?.amountInCHF || 0);
    }
    return acc;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Configuration & Upload Bar */}
      <div className="bg-white p-6 rounded-sm shadow-sm border border-ypsom-alice flex flex-col gap-6">
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Target Currency Selection */}
          <div className="w-full md:w-48">
            <label className="block text-[10px] font-bold text-ypsom-slate uppercase tracking-wider mb-2">Reporting Currency</label>
            <div className="relative">
              <select 
                value={reportingCurrency}
                onChange={(e) => setReportingCurrency(e.target.value)}
                disabled={isProcessing}
                className="w-full pl-8 pr-3 py-2 border border-ypsom-alice rounded-sm bg-white text-sm font-bold text-ypsom-deep focus:ring-1 focus:ring-ypsom-deep outline-none appearance-none disabled:opacity-50"
              >
                <option value="CHF">CHF (Swiss Franc)</option>
                <option value="EUR">EUR (Euro)</option>
                <option value="USD">USD (US Dollar)</option>
                <option value="GBP">GBP (British Pound)</option>
              </select>
              <Coins className="w-4 h-4 text-ypsom-slate absolute left-2.5 top-2.5" />
            </div>
            <p className="text-[9px] text-ypsom-slate mt-1 italic">Foreign receipts will auto-convert to this.</p>
          </div>

          <label className="flex-1 w-full group flex flex-col items-center justify-center h-24 border-2 border-dashed border-ypsom-alice rounded-sm cursor-pointer hover:bg-ypsom-alice/20 transition-all">
            <div className="flex items-center">
              <Upload className="w-4 h-4 text-ypsom-slate mr-2 group-hover:text-ypsom-deep transition-colors" />
              <p className="text-xs font-medium">Click to upload receipts or statements</p>
            </div>
            <input type="file" className="hidden" multiple accept="image/*,application/pdf" onChange={handleFileUpload} />
          </label>

          <div className="flex gap-2 w-full md:w-auto">
            {isProcessing ? (
              <button onClick={handleStop} className="flex-1 md:flex-none bg-red-600 text-white px-6 py-2.5 rounded-sm font-bold text-xs hover:bg-red-700 transition-all shadow-md flex items-center justify-center">
                <StopCircle className="w-4 h-4 mr-2" /> Stop
              </button>
            ) : (
              <button onClick={processAll} disabled={stats.total === 0 || stats.pending === 0} className="flex-1 md:flex-none bg-ypsom-deep text-white px-6 py-2.5 rounded-sm font-bold text-xs hover:bg-ypsom-shadow transition-all shadow-md disabled:opacity-50 flex items-center justify-center">
                <RefreshCcw className="w-4 h-4 mr-2" /> Start Analysis
              </button>
            )}
          </div>
        </div>

        {/* Global Progress Bar */}
        {(isProcessing || stats.progress > 0) && stats.total > 0 && (
          <div className="w-full space-y-2 pt-2 border-t border-ypsom-alice">
            <div className="flex justify-between items-center text-[10px] font-bold uppercase text-ypsom-slate">
              <span>Batch Progress ({stats.completed}/{stats.total})</span>
              <span>{Math.round(stats.progress)}%</span>
            </div>
            <div className="w-full h-1.5 bg-ypsom-alice rounded-full overflow-hidden">
              <div 
                className="h-full bg-ypsom-deep transition-all duration-500 ease-out"
                style={{ width: `${stats.progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {completed.length > 0 && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex justify-between items-center border-b border-ypsom-alice pb-3">
            <div className="flex gap-4 items-center">
              <h2 className="text-xl font-bold text-ypsom-deep">Reconciled Ledger</h2>
              {!isProcessing && (
                <button onClick={handleReconcile} className="text-[10px] font-bold text-ypsom-deep flex items-center bg-ypsom-alice/40 px-4 py-2 rounded-full border border-ypsom-alice hover:bg-ypsom-alice transition-colors">
                  <LinkIcon className="w-3 h-3 mr-2" /> Match Statement Lines
                </button>
              )}
            </div>
            <div className="text-right">
              <p className="text-[10px] text-ypsom-slate uppercase font-bold">Reporting Total ({reportingCurrency})</p>
              <p className="text-2xl font-mono font-bold text-ypsom-deep">{totalExpense.toFixed(2)}</p>
            </div>
          </div>

          <div className="bg-white rounded-sm shadow-md border border-ypsom-alice overflow-hidden">
            <table className="min-w-full divide-y divide-ypsom-alice text-[11px]">
              <thead className="bg-ypsom-shadow text-white font-bold uppercase">
                <tr>
                  <th className="px-3 py-4 w-8"></th>
                  <th className="px-3 py-4 text-left">Date</th>
                  <th className="px-3 py-4 text-left">Issuer</th>
                  <th className="px-3 py-4 text-left">Original Amt</th>
                  <th className="px-3 py-4 text-left">VAT</th>
                  <th className="px-3 py-4 text-right">Ex. Rate</th>
                  <th className="px-3 py-4 text-right">Total ({reportingCurrency})</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-ypsom-alice">
                {documents.map((doc) => {
                  if (doc.status !== 'completed' || !doc.data) {
                    if (doc.status === 'processing' || doc.status === 'pending') {
                      return (
                        <tr key={doc.id} className="opacity-50">
                          <td className="px-3 py-3 text-center">
                            {doc.status === 'processing' ? <Loader2 className="w-3 h-3 animate-spin text-ypsom-deep mx-auto" /> : <FileText className="w-3 h-3 mx-auto" />}
                          </td>
                          <td className="px-3 py-3 font-italic" colSpan={6}>{doc.fileName} — {doc.status}...</td>
                        </tr>
                      );
                    }
                    return null;
                  }

                  const isBank = doc.data.documentType === DocumentType.BANK_STATEMENT;
                  const isExpanded = expandedDocs.has(doc.id);
                  const isForeign = doc.data.originalCurrency !== reportingCurrency;

                  return (
                    <React.Fragment key={doc.id}>
                      <tr onClick={() => isBank && toggleExpand(doc.id)} className={`${isBank ? 'bg-ypsom-alice/20 font-bold cursor-pointer border-l-4 border-l-ypsom-deep' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}`}>
                        <td className="px-3 py-4 text-center">{isBank && (isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)}</td>
                        <td className="px-3 py-4 whitespace-nowrap">{doc.data.date}</td>
                        <td className="px-3 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-ypsom-deep">{doc.data.issuer}</span>
                            <span className="text-[9px] text-ypsom-slate uppercase">{doc.data.documentType}</span>
                          </div>
                        </td>
                        <td className="px-3 py-4">
                           <div className="flex flex-col">
                             <span className="font-mono">{doc.data.totalAmount.toFixed(2)} {doc.data.originalCurrency}</span>
                             {doc.data.handwrittenRef && <span className="text-[9px] bg-yellow-100 px-1 rounded inline-block w-fit mt-1">Ref: {doc.data.handwrittenRef}</span>}
                           </div>
                        </td>
                        <td className="px-3 py-4 font-mono text-ypsom-slate">
                          {doc.data.vatAmount ? doc.data.vatAmount.toFixed(2) : '0.00'}
                        </td>
                        <td className="px-3 py-4 text-right font-mono text-[9px]">
                          {isForeign ? doc.data.conversionRateUsed?.toFixed(4) : '-'}
                        </td>
                        <td className="px-3 py-4 text-right font-bold font-mono text-ypsom-deep bg-ypsom-alice/5">
                          {doc.data.amountInCHF.toFixed(2)}
                        </td>
                      </tr>
                      {isBank && isExpanded && doc.data.lineItems?.map((line, i) => {
                        const isReconciled = line.notes?.includes('Linked');
                        return (
                          <tr key={i} className={`text-[10px] ${isReconciled ? 'bg-green-50/50' : 'bg-gray-50/50'}`}>
                            <td className="px-3 py-2 border-l-4 border-ypsom-deep opacity-30 text-center">•</td>
                            <td className="px-3 py-2 opacity-60 font-mono">{line.date}</td>
                            <td className="px-3 py-2 italic font-medium" colSpan={2}>
                               {line.description}
                               {isReconciled && (
                                 <span className="ml-2 inline-flex items-center text-[8px] text-green-700 bg-green-100 px-1 rounded font-bold uppercase tracking-tighter">
                                   <LinkIcon className="w-2 h-2 mr-1" /> Linked
                                 </span>
                               )}
                            </td>
                            <td className="px-3 py-2">
                               {line.supportingDocRef && (
                                 <span className="bg-ypsom-alice text-ypsom-deep px-1.5 py-0.5 rounded font-bold border border-ypsom-slate/20">
                                   {line.supportingDocRef}
                                 </span>
                               )}
                            </td>
                            <td className="px-3 py-2 text-right opacity-60 font-mono">
                              {line.type === 'INCOME' ? `+${line.amount.toFixed(2)}` : `-${line.amount.toFixed(2)}`}
                            </td>
                            <td className="px-3 py-2 text-right font-bold font-mono opacity-80">{line.amount.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
             <button onClick={handleGenerateSummary} disabled={isGeneratingSummary} className="flex items-center text-[10px] bg-white border border-ypsom-alice px-4 py-2 rounded shadow-sm hover:bg-gray-50 font-bold uppercase text-ypsom-slate">
                {isGeneratingSummary ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Sparkles className="w-3 h-3 mr-2" />} Get AI Summary
             </button>
             <button 
                onClick={() => exportToExcel(completed.map(d => d.data!), DocumentType.INVOICE)} 
                className="flex items-center text-[10px] bg-ypsom-deep text-white px-4 py-2 rounded shadow-sm hover:bg-ypsom-shadow font-bold uppercase tracking-wider"
             >
                <Download className="w-3 h-3 mr-2" /> Extract as Excel (XLSX)
             </button>
          </div>
          
          {summary && (
            <div className="p-6 bg-ypsom-alice/10 border border-ypsom-alice rounded-sm mt-4 animate-in slide-in-from-bottom-2">
               <h4 className="text-xs font-black text-ypsom-deep uppercase tracking-widest mb-2 flex items-center">
                 <Sparkles className="w-3 h-3 mr-2" /> Executive Audit Summary
               </h4>
               <p className="text-sm text-ypsom-shadow leading-relaxed whitespace-pre-line">{summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
