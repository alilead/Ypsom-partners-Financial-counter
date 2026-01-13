
import React, { useState, useRef, useMemo } from 'react';
import { Upload, CheckCircle, XCircle, Loader2, Download, Trash2, Coins, AlertCircle, X, AlertTriangle, Zap, Clock, ExternalLink, Cpu, Ban, FileText, ChevronDown, ChevronRight, Database, ReceiptText, TrendingUp, BarChart3 } from 'lucide-react';
import { analyzeFinancialDocument } from '../services/geminiService';
import { exportToExcel } from '../services/excelService';
import { ProcessedDocument, DocumentType } from '../types';

interface DocumentProcessorProps {
  documents: ProcessedDocument[];
  setDocuments: React.Dispatch<React.SetStateAction<ProcessedDocument[]>>;
}

export const DocumentProcessor: React.FC<DocumentProcessorProps> = ({ documents, setDocuments }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [reportingCurrency, setReportingCurrency] = useState('CHF');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeWorkerCount, setActiveWorkerCount] = useState(0);
  const stopProcessingRef = useRef(false);

  const stats = useMemo(() => {
    const total = documents.length;
    const completed = documents.filter(d => d.status === 'completed').length;
    const errors = documents.filter(d => d.status === 'error').length;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    return { total, completed, progress, errors };
  }, [documents]);

  const addFiles = (files: File[]) => {
    const newDocs: ProcessedDocument[] = Array.from(files).map(f => {
      // Duplicate detection: check filename AND size to be sure
      const isDuplicate = documents.some(doc => doc.fileName === f.name && doc.fileRaw?.size === f.size);
      
      return {
        id: Math.random().toString(36).substr(2, 9),
        fileName: f.name,
        status: isDuplicate ? 'error' : 'pending',
        error: isDuplicate ? 'Duplicate File: This document has already been added to the queue.' : undefined,
        fileRaw: f
      };
    });
    setDocuments(prev => [...prev, ...newDocs]);
  };

  const processAll = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    stopProcessingRef.current = false;
    
    const pendingIndices = documents
      .map((d, i) => (d.status === 'pending') ? i : -1)
      .filter(i => i !== -1);

    const CONCURRENCY = 5;
    let currentIdx = 0;
    const tasks = new Set<Promise<void>>();

    const run = async (idx: number) => {
      const doc = documents[idx];
      if (!doc.fileRaw) return;
      setActiveWorkerCount(prev => prev + 1);
      setDocuments(prev => prev.map((d, i) => i === idx ? { ...d, status: 'processing', error: undefined } : d));

      try {
        const result = await analyzeFinancialDocument(doc.fileRaw, reportingCurrency);
        setDocuments(prev => prev.map((d, i) => i === idx ? { ...d, status: 'completed', data: result } : d));
      } catch (err: any) {
        setDocuments(prev => prev.map((d, i) => i === idx ? { ...d, status: 'error', error: err.message } : d));
      } finally {
        setActiveWorkerCount(prev => prev - 1);
      }
    };

    while (currentIdx < pendingIndices.length && !stopProcessingRef.current) {
      while (tasks.size < CONCURRENCY && currentIdx < pendingIndices.length) {
        const idx = pendingIndices[currentIdx++];
        const t = run(idx).finally(() => tasks.delete(t));
        tasks.add(t);
      }
      await Promise.race(tasks);
    }
    await Promise.all(tasks);
    setIsProcessing(false);
  };

  const invoices = useMemo(() => documents.filter(d => d.status === 'completed' && d.data?.documentType !== DocumentType.BANK_STATEMENT), [documents]);
  const statements = useMemo(() => documents.filter(d => d.status === 'completed' && d.data?.documentType === DocumentType.BANK_STATEMENT), [documents]);

  const invoiceSummary = useMemo(() => {
    const total = invoices.reduce((sum, doc) => sum + (doc.data?.amountInCHF || 0), 0);
    return { total, count: invoices.length };
  }, [invoices]);

  return (
    <div className="space-y-10">
      {/* Action Header */}
      <div className="bg-white p-8 rounded-sm shadow-sm border border-ypsom-alice grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        <div className="md:col-span-2 space-y-4">
           <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-ypsom-alice hover:bg-ypsom-alice/10 rounded-sm cursor-pointer transition-all group">
              <Upload className="w-8 h-8 mb-3 text-ypsom-slate group-hover:text-ypsom-deep transition-transform" />
              <div className="text-center">
                <p className="text-[11px] font-black uppercase tracking-widest text-ypsom-slate">Audit Evidence Submission</p>
                <p className="text-[9px] text-ypsom-slate/60 mt-1 uppercase">PDF • JPG • PNG (Max 100+ files)</p>
              </div>
              <input type="file" className="hidden" multiple onChange={(e) => e.target.files && addFiles(Array.from(e.target.files))} />
           </label>
        </div>

        <div className="space-y-4">
           <button 
             onClick={processAll} 
             disabled={isProcessing || stats.total === 0}
             className="w-full h-16 bg-ypsom-deep text-white rounded-sm font-black text-[14px] uppercase tracking-[0.2em] shadow-lg hover:bg-ypsom-shadow disabled:opacity-50 transition-all flex items-center justify-center"
           >
             {isProcessing ? (
               <div className="flex items-center gap-3">
                 <Loader2 className="w-5 h-5 animate-spin" />
                 Extracting...
               </div>
             ) : (
               <span>Run ({stats.total})</span>
             )}
           </button>
           
           <div className="p-4 bg-white border border-ypsom-alice rounded-sm">
              <div className="flex justify-between text-[10px] font-black text-ypsom-slate uppercase tracking-widest mb-2">
                <span>Queue Flow</span>
              </div>
              <div className="flex justify-between text-[11px] font-bold text-ypsom-deep">
                <span>Done: {stats.completed}</span>
                <span>Errors: {stats.errors}</span>
              </div>
              <div className="mt-2 w-full h-1 bg-ypsom-alice rounded-full overflow-hidden">
                <div className="h-full bg-ypsom-deep transition-all duration-700" style={{ width: `${stats.progress}%` }} />
              </div>
           </div>
        </div>
      </div>

      {/* Audit Queue Diagnostics */}
      {documents.length > 0 && (
        <div className="bg-white rounded-sm border border-ypsom-alice overflow-hidden shadow-sm">
          <div className="px-6 py-4 bg-gray-50 border-b border-ypsom-alice flex justify-between items-center">
             <h3 className="text-[10px] font-black uppercase tracking-widest text-ypsom-slate flex items-center gap-2">
               <Cpu className="w-4 h-4" /> Gemini 3.0 Audit Feed
             </h3>
             <button onClick={() => setDocuments([])} className="text-[10px] font-bold text-red-600 hover:underline uppercase">Clear Queue</button>
          </div>
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            <table className="min-w-full text-[11px]">
              <thead className="bg-white sticky top-0 z-10 border-b border-ypsom-alice shadow-sm">
                <tr className="text-left font-black text-ypsom-slate uppercase tracking-tighter">
                  <th className="px-6 py-4 w-1/3">Full Document Filename</th>
                  <th className="px-6 py-4 w-[15%]">Status</th>
                  <th className="px-6 py-4">Diagnostic Result</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ypsom-alice">
                {documents.map(doc => (
                  <tr key={doc.id} className={`${doc.status === 'error' ? 'bg-red-50/50' : 'hover:bg-gray-50/30'}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <FileText className={`w-4 h-4 ${doc.status === 'error' ? 'text-red-400' : 'text-ypsom-slate'}`} />
                        <span className="font-bold text-ypsom-deep break-all">{doc.fileName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                         {doc.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin text-ypsom-deep" />}
                         <span className={`uppercase font-black text-[10px] ${doc.status === 'completed' ? 'text-green-600' : doc.status === 'error' ? 'text-red-600' : 'text-ypsom-slate'}`}>
                          {doc.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {doc.error ? (
                        <div className="flex items-start gap-3 p-3 bg-white border border-red-100 rounded-sm shadow-sm text-red-700">
                          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <p className="font-bold leading-relaxed">{doc.error}</p>
                        </div>
                      ) : (
                        <span className="italic text-ypsom-slate opacity-60">
                          {doc.status === 'completed' ? 'Audited successfully.' : doc.status === 'processing' ? 'Extracting visual artifacts...' : 'Queueing...'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                       <button onClick={() => setDocuments(prev => prev.filter(d => d.id !== doc.id))} className="p-2 text-ypsom-slate/40 hover:text-red-600">
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RESULTS: INVOICE LEDGER */}
      {invoices.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="flex flex-col md:flex-row md:items-end justify-between border-b-2 border-ypsom-deep/20 pb-4 mb-6 gap-4">
              <div>
                <h2 className="text-xl font-black text-ypsom-deep uppercase tracking-widest flex items-center gap-3">
                  <ReceiptText className="w-6 h-6" /> Invoice Ledger
                </h2>
                <p className="text-[11px] text-ypsom-slate font-bold uppercase mt-1 opacity-60">Cumulative audit for fiscal reconciliation.</p>
              </div>
              <div className="bg-ypsom-deep px-6 py-3 rounded-sm text-white shadow-xl flex items-center gap-4">
                 <div className="p-2 bg-white/10 rounded-sm">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                 </div>
                 <div>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Total Audited Volume</p>
                    <p className="text-lg font-black font-mono">
                      {invoiceSummary.total.toLocaleString('en-CH', { minimumFractionDigits: 2 })} <span className="text-xs">{reportingCurrency}</span>
                    </p>
                 </div>
              </div>
           </div>

           <div className="bg-white rounded-sm shadow-xl border border-ypsom-alice overflow-hidden">
             <table className="min-w-full text-[12px]">
               <thead className="bg-ypsom-shadow text-white uppercase tracking-widest font-black">
                 <tr>
                   <th className="px-6 py-5 text-left">Date</th>
                   <th className="px-6 py-5 text-left">Entity / Issuer</th>
                   <th className="px-6 py-5 text-right">Original Value</th>
                   <th className="px-6 py-5 text-right">Audited Sum ({reportingCurrency})</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-ypsom-alice">
                 {invoices.map(doc => (
                   <tr key={doc.id} className="hover:bg-ypsom-alice/5 transition-colors">
                     <td className="px-6 py-5 font-mono text-ypsom-slate">{doc.data!.date}</td>
                     <td className="px-6 py-5">
                        <div className="flex flex-col">
                           <span className="font-black text-ypsom-deep text-sm">{doc.data!.issuer}</span>
                           <span className="text-[9px] font-bold text-ypsom-slate uppercase tracking-tighter opacity-40">Ref: {doc.data!.documentNumber || 'N/A'}</span>
                        </div>
                     </td>
                     <td className="px-6 py-5 text-right">
                       <span className="font-bold text-ypsom-slate">
                          {doc.data!.totalAmount.toLocaleString()} <span className="text-[9px] opacity-60 font-black">{doc.data!.originalCurrency}</span>
                       </span>
                     </td>
                     <td className="px-6 py-5 text-right font-black text-ypsom-deep text-sm bg-ypsom-alice/5">
                        {doc.data!.amountInCHF.toLocaleString('en-CH', { minimumFractionDigits: 2 })}
                     </td>
                   </tr>
                 ))}
               </tbody>
               <tfoot className="bg-ypsom-alice/20 border-t-2 border-ypsom-alice font-black">
                  <tr>
                    <td colSpan={3} className="px-6 py-5 text-right text-ypsom-slate uppercase tracking-widest">Grand Total Audited:</td>
                    <td className="px-6 py-5 text-right text-lg text-ypsom-deep font-mono">
                       {invoiceSummary.total.toLocaleString('en-CH', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
               </tfoot>
             </table>
           </div>
        </div>
      )}

      {/* BANK STATEMENTS SECTION */}
      {statements.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
           <div className="flex justify-between items-end border-b-2 border-amber-300 pb-4 mb-6">
              <h2 className="text-xl font-black text-amber-900 uppercase tracking-widest flex items-center gap-3">
                <Database className="w-6 h-6" /> Bank Flow Reconciler
              </h2>
           </div>
           
           <div className="bg-white rounded-sm shadow-xl border border-amber-200 overflow-hidden">
              <table className="min-w-full text-[12px]">
                <thead className="bg-amber-800 text-white uppercase tracking-widest font-black">
                  <tr>
                    <th className="px-6 py-5 w-12"></th>
                    <th className="px-6 py-5 text-left">Period</th>
                    <th className="px-6 py-5 text-left">Financial Institution</th>
                    <th className="px-6 py-5 text-right">Closing Flow</th>
                    <th className="px-6 py-5 text-right">Currency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {statements.map(doc => {
                    const isOpen = expandedId === doc.id;
                    return (
                      <React.Fragment key={doc.id}>
                        <tr className="hover:bg-amber-50/50 transition-colors bg-amber-50/10">
                          <td className="px-6 py-5">
                            <button onClick={() => setExpandedId(isOpen ? null : doc.id)} className="p-2 hover:bg-amber-200 rounded-sm">
                              {isOpen ? <ChevronDown className="w-5 h-5 text-amber-700" /> : <ChevronRight className="w-5 h-5 text-amber-700" />}
                            </button>
                          </td>
                          <td className="px-6 py-5 font-mono font-bold text-amber-900">{doc.data!.date}</td>
                          <td className="px-6 py-5 font-black text-amber-950 uppercase">{doc.data!.issuer}</td>
                          <td className="px-6 py-5 text-right font-black text-amber-900">
                             {doc.data!.totalAmount.toLocaleString()}
                          </td>
                          <td className="px-6 py-5 text-right font-black text-amber-700/60 uppercase">{doc.data!.originalCurrency}</td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={5} className="bg-amber-50/50 px-12 py-8 border-y border-amber-100">
                               <div className="bg-white rounded-sm border border-amber-200 shadow-xl overflow-hidden animate-in slide-in-from-top-4">
                                  <table className="min-w-full text-[11px]">
                                     <thead className="bg-white text-amber-900 font-black uppercase border-b border-amber-100 shadow-sm">
                                        <tr>
                                           <th className="px-6 py-3 text-left">Date</th>
                                           <th className="px-6 py-3 text-left">Description</th>
                                           <th className="px-6 py-3 text-right">Amount</th>
                                        </tr>
                                     </thead>
                                     <tbody className="divide-y divide-amber-50">
                                        {doc.data!.lineItems?.map((t, i) => (
                                          <tr key={i} className="hover:bg-amber-50/50">
                                             <td className="px-6 py-3 font-mono text-amber-700">{t.date}</td>
                                             <td className="px-6 py-3 font-bold text-amber-950">{t.description}</td>
                                             <td className={`px-6 py-3 text-right font-mono font-black ${t.type === 'INCOME' ? 'text-green-700' : 'text-red-700'}`}>
                                                {t.type === 'INCOME' ? '+' : '-'}{t.amount.toLocaleString()}
                                             </td>
                                          </tr>
                                        ))}
                                     </tbody>
                                  </table>
                               </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
           </div>
        </div>
      )}
    </div>
  );
};
