
import React, { useState, useRef, useMemo } from 'react';
import { Upload, CheckCircle, XCircle, Loader2, Download, Trash2, Coins, AlertCircle, X, AlertTriangle, Zap, Clock, ExternalLink, Cpu, Ban, FileText, ChevronDown, ChevronRight, Database, ReceiptText, TrendingUp, BarChart3, FileSearch, Sparkles, Building2, Edit3, FileSpreadsheet } from 'lucide-react';
import { analyzeFinancialDocument, generateAuditSummary } from '../services/geminiService';
import { exportToExcel } from '../services/excelService';
import { ProcessedDocument, DocumentType } from '../types';

interface DocumentProcessorProps {
  documents: ProcessedDocument[];
  setDocuments: React.Dispatch<React.SetStateAction<ProcessedDocument[]>>;
}

export const DocumentProcessor: React.FC<DocumentProcessorProps> = ({ documents, setDocuments }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
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
    const newDocs: ProcessedDocument[] = Array.from(files).map(f => ({
      id: Math.random().toString(36).substr(2, 9),
      fileName: f.name,
      status: 'pending',
      fileRaw: f
    }));
    setDocuments(prev => [...prev, ...newDocs]);
  };

  const processAll = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    stopProcessingRef.current = false;
    
    const pendingIndices = documents
      .map((d, i) => (d.status === 'pending' || d.status === 'error') ? i : -1)
      .filter(i => i !== -1);

    const run = async (idx: number) => {
      const doc = documents[idx];
      if (!doc.fileRaw) return;
      setActiveWorkerCount(prev => prev + 1);
      setDocuments(prev => prev.map((d, i) => i === idx ? { ...d, status: 'processing' } : d));

      try {
        const result = await analyzeFinancialDocument(doc.fileRaw, reportingCurrency);
        setDocuments(prev => prev.map((d, i) => i === idx ? { ...d, status: 'completed', data: result } : d));
      } catch (err: any) {
        setDocuments(prev => prev.map((d, i) => i === idx ? { ...d, status: 'error', error: err.message } : d));
      } finally {
        setActiveWorkerCount(prev => prev - 1);
      }
    };

    for (const idx of pendingIndices) {
      if (stopProcessingRef.current) break;
      await run(idx);
    }
    setIsProcessing(false);
  };

  const handleManualAmountChange = (docId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setDocuments(prev => prev.map(doc => {
      if (doc.id === docId && doc.data) {
        const rate = doc.data.conversionRateUsed || 1;
        return {
          ...doc,
          data: {
            ...doc.data,
            totalAmount: numValue,
            amountInCHF: numValue * rate
          }
        };
      }
      return doc;
    }));
  };

  const invoices = useMemo(() => documents.filter(d => d.status === 'completed' && d.data?.documentType !== DocumentType.BANK_STATEMENT), [documents]);
  const statements = useMemo(() => documents.filter(d => d.status === 'completed' && d.data?.documentType === DocumentType.BANK_STATEMENT), [documents]);

  const invoiceSummary = useMemo(() => {
    const total = invoices.reduce((sum, doc) => sum + (doc.data?.amountInCHF || 0), 0);
    const totalVat = invoices.reduce((sum, doc) => sum + (doc.data?.vatAmount || 0), 0);
    return { total, totalVat };
  }, [invoices]);

  const handleExport = () => {
    const dataToExport = invoices.map(inv => inv.data!);
    exportToExcel(dataToExport, 'Audit_Ledger', reportingCurrency);
  };

  return (
    <div className="space-y-10">
      <div className="bg-white p-8 rounded-sm shadow-sm border border-ypsom-alice grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        <div className="lg:col-span-2">
           <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-ypsom-alice hover:bg-ypsom-alice/10 rounded-sm cursor-pointer transition-all group">
              <Upload className="w-8 h-8 mb-3 text-ypsom-slate group-hover:text-ypsom-deep" />
              <p className="text-[11px] font-black uppercase tracking-widest text-ypsom-slate">Audit Evidence Submission</p>
              <input type="file" className="hidden" multiple onChange={(e) => e.target.files && addFiles(Array.from(e.target.files))} />
           </label>
        </div>
        <div>
           <label className="block text-[10px] font-black uppercase tracking-widest text-ypsom-slate mb-2">Audit Currency</label>
           <select 
             value={reportingCurrency} 
             onChange={(e) => setReportingCurrency(e.target.value)}
             className="w-full h-12 bg-gray-50 border border-ypsom-alice rounded-sm px-4 text-xs font-bold text-ypsom-deep focus:ring-1 focus:ring-ypsom-deep outline-none"
           >
             <option value="CHF">CHF (Swiss Franc)</option>
             <option value="EUR">EUR (Euro)</option>
             <option value="USD">USD (US Dollar)</option>
           </select>
        </div>
        <button 
          onClick={processAll} 
          disabled={isProcessing || stats.total === 0}
          className="h-12 bg-ypsom-deep text-white rounded-sm font-black text-[11px] uppercase tracking-[0.2em] shadow-lg hover:bg-ypsom-shadow disabled:opacity-50 flex items-center justify-center"
        >
          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Start Audit ({stats.total})</span>}
        </button>
      </div>

      {invoices.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="flex flex-col md:flex-row md:items-end justify-between border-b-2 border-ypsom-deep/20 pb-4 mb-6 gap-4">
              <div>
                <h2 className="text-xl font-black text-ypsom-deep uppercase tracking-widest flex items-center gap-3">
                  <ReceiptText className="w-6 h-6" /> Invoice Ledger
                </h2>
                <p className="text-[11px] text-ypsom-slate font-bold uppercase mt-1 opacity-60">Cumulative audit for fiscal reconciliation.</p>
              </div>
              <div className="flex items-center gap-4">
                 <button 
                   onClick={handleExport}
                   className="h-12 px-6 bg-white border border-ypsom-deep text-ypsom-deep rounded-sm font-black text-[11px] uppercase tracking-[0.2em] hover:bg-ypsom-alice/20 flex items-center gap-2"
                 >
                   <FileSpreadsheet className="w-4 h-4" /> Export Ledger (.xlsx)
                 </button>
                 <div className="bg-ypsom-deep px-6 py-3 rounded-sm text-white shadow-xl flex items-center gap-8">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Audited Volume</p>
                      <p className="text-lg font-black font-mono">{invoiceSummary.total.toLocaleString()} <span className="text-xs">{reportingCurrency}</span></p>
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-white rounded-sm shadow-xl border border-ypsom-alice overflow-x-auto">
             <table className="min-w-full text-[12px]">
               <thead className="bg-ypsom-shadow text-white uppercase tracking-widest font-black">
                 <tr>
                   <th className="px-6 py-5 text-left">Date</th>
                   <th className="px-6 py-5 text-left">Entity</th>
                   <th className="px-6 py-5 text-right">Original Value</th>
                   <th className="px-6 py-5 text-right">VAT</th>
                   <th className="px-6 py-5 text-right bg-ypsom-deep/5">Audited Sum ({reportingCurrency})</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-ypsom-alice">
                 {invoices.map(doc => {
                   const needsReview = doc.data?.totalAmount === 0;
                   return (
                     <tr key={doc.id} className="hover:bg-ypsom-alice/5">
                       <td className="px-6 py-5 font-mono text-ypsom-slate">{doc.data!.date}</td>
                       <td className="px-6 py-5">
                          <div className="flex flex-col">
                             <span className="font-black text-ypsom-deep text-sm">{doc.data!.issuer}</span>
                             <span className="text-[9px] font-bold text-ypsom-slate uppercase opacity-40">{doc.fileName}</span>
                          </div>
                       </td>
                       <td className="px-6 py-5 text-right">
                          {needsReview ? (
                            <div className="relative inline-block">
                               <input 
                                 type="number" 
                                 placeholder="Enter Amount"
                                 className="w-32 text-right px-2 py-1 border-2 border-amber-300 bg-amber-50 rounded-sm font-bold text-ypsom-deep outline-none focus:ring-1 focus:ring-amber-500"
                                 onChange={(e) => handleManualAmountChange(doc.id, e.target.value)}
                               />
                               <span className="absolute -top-4 right-0 text-[8px] font-black text-amber-600 uppercase">Action Needed</span>
                            </div>
                          ) : (
                            <span className="font-bold text-ypsom-slate">
                              {doc.data!.totalAmount.toLocaleString()} <span className="text-[9px] opacity-60">{doc.data!.originalCurrency}</span>
                            </span>
                          )}
                       </td>
                       <td className="px-6 py-5 text-right font-mono text-ypsom-slate/60">
                         {doc.data!.vatAmount?.toFixed(2) || '0.00'}
                       </td>
                       <td className="px-6 py-5 text-right font-black text-ypsom-deep text-sm bg-ypsom-alice/10">
                          {doc.data!.amountInCHF.toLocaleString('en-CH', { minimumFractionDigits: 2 })}
                       </td>
                     </tr>
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
