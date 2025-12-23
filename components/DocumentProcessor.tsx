
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Loader2, Download, RefreshCcw, Sparkles, StopCircle, ChevronDown, ChevronRight, Link as LinkIcon, Trash2, Coins, AlertCircle, X } from 'lucide-react';
import { analyzeFinancialDocument, generateFinancialSummary, reconcileDocuments } from '../services/geminiService';
import { exportToExcel } from '../services/excelService';
import { ProcessedDocument, DocumentType, FinancialData } from '../types';

interface Notification {
  id: string;
  message: string;
  type: 'warning' | 'error' | 'success';
}

export const DocumentProcessor: React.FC = () => {
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [reportingCurrency, setReportingCurrency] = useState('CHF');
  const [summary, setSummary] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const stopProcessingRef = useRef(false);

  const stats = useMemo(() => {
    const total = documents.length;
    const completed = documents.filter(d => d.status === 'completed').length;
    const pending = documents.filter(d => d.status === 'pending').length;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    return { total, completed, pending, progress };
  }, [documents]);

  const addNotification = (message: string, type: 'warning' | 'error' | 'success' = 'warning') => {
    const id = Math.random().toString(36).substring(7);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const removeFile = (id: string) => {
    if (isProcessing) return;
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  const addFiles = (files: File[]) => {
    const newValidFiles: ProcessedDocument[] = [];
    
    files.forEach(file => {
      const isDuplicate = documents.some(d => d.fileName === file.name && d.fileRaw?.size === file.size);
      if (isDuplicate) {
        addNotification(`Duplicate ignored: ${file.name}`, 'warning');
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
      setDocuments(prev => [...prev, ...newValidFiles]);
      setSummary(null);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      addFiles(Array.from(event.target.files));
      event.target.value = ''; 
    }
  };

  const processAll = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    stopProcessingRef.current = false;
    
    const pendingIndices = documents
      .map((d, i) => (d.status === 'pending' || d.status === 'error') ? i : -1)
      .filter(i => i !== -1);

    for (const index of pendingIndices) {
      if (stopProcessingRef.current) break;
      
      const doc = documents[index];
      if (!doc.fileRaw) continue;

      setDocuments(prev => prev.map((d, i) => i === index ? { ...d, status: 'processing', error: undefined } : d));

      try {
        const result = await analyzeFinancialDocument(doc.fileRaw, reportingCurrency);
        setDocuments(prev => prev.map((d, i) => i === index ? { ...d, status: 'completed', data: result } : d));
        if (result.documentType === DocumentType.BANK_STATEMENT) {
          setExpandedDocs(prev => new Set(prev).add(doc.id));
        }
      } catch (err: any) {
        setDocuments(prev => prev.map((d, i) => i === index ? { ...d, status: 'error', error: err.message } : d));
        addNotification(`Error processing ${doc.fileName}: ${err.message}`, 'error');
      }
    }
    setIsProcessing(false);
  };

  const handleStop = () => {
    stopProcessingRef.current = true;
    setIsProcessing(false);
  };

  const toggleExpand = (id: string) => {
    setExpandedDocs(prev => { 
      const next = new Set(prev); 
      if (next.has(id)) next.delete(id); else next.add(id); 
      return next; 
    });
  };

  const completed = documents.filter(d => d.status === 'completed' && d.data);
  const totalExpense = completed.reduce((acc, doc) => {
    if (doc.data?.documentType !== DocumentType.BANK_STATEMENT) {
      return acc + (doc.data?.amountInCHF || 0);
    }
    return acc;
  }, 0);

  return (
    <div className="space-y-6 relative">
      {/* Pop-up Notifications */}
      <div className="fixed top-24 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        {notifications.map(n => (
          <div key={n.id} className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-sm shadow-xl border-l-4 animate-in slide-in-from-right duration-300 ${
            n.type === 'warning' ? 'bg-amber-50 border-amber-500 text-amber-800' :
            n.type === 'error' ? 'bg-red-50 border-red-500 text-red-800' : 'bg-green-50 border-green-500 text-green-800'
          }`}>
            {n.type === 'warning' && <AlertCircle className="w-4 h-4" />}
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
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-full md:w-48">
            <label className="block text-[10px] font-bold text-ypsom-slate uppercase tracking-wider mb-2">Reporting Currency</label>
            <div className="relative">
              <select 
                value={reportingCurrency}
                onChange={(e) => setReportingCurrency(e.target.value)}
                disabled={isProcessing}
                className="w-full pl-8 pr-3 py-2 border border-ypsom-alice rounded-sm bg-white text-sm font-bold text-ypsom-deep focus:ring-1 focus:ring-ypsom-deep outline-none appearance-none disabled:opacity-50"
              >
                <option value="CHF">CHF</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
              <Coins className="w-4 h-4 text-ypsom-slate absolute left-2.5 top-2.5" />
            </div>
          </div>

          <label 
            className={`flex-1 w-full group flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-sm cursor-pointer transition-all ${
              isDragging ? 'border-ypsom-deep bg-ypsom-alice/40' : 'border-ypsom-alice hover:bg-ypsom-alice/20'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files)); }}
          >
            <Upload className="w-6 h-6 mb-2 text-ypsom-slate group-hover:text-ypsom-deep" />
            <p className="text-xs font-bold uppercase tracking-widest text-ypsom-slate group-hover:text-ypsom-deep">Upload Invoices & Receipts</p>
            <p className="text-[10px] text-ypsom-slate mt-1 opacity-60">PDF or Multi-image Batch</p>
            <input type="file" className="hidden" multiple accept="image/*,application/pdf" onChange={handleFileUpload} />
          </label>

          <div className="flex gap-2 w-full md:w-auto">
            {isProcessing ? (
              <button onClick={handleStop} className="flex-1 md:flex-none bg-red-600 text-white px-8 py-3 rounded-sm font-bold text-xs hover:bg-red-700 transition-all shadow-md flex items-center justify-center uppercase tracking-widest">
                <StopCircle className="w-4 h-4 mr-2" /> Stop
              </button>
            ) : (
              <button onClick={processAll} disabled={stats.pending === 0} className="flex-1 md:flex-none bg-ypsom-deep text-white px-8 py-3 rounded-sm font-bold text-xs hover:bg-ypsom-shadow transition-all shadow-md disabled:opacity-50 flex items-center justify-center uppercase tracking-widest">
                <RefreshCcw className="w-4 h-4 mr-2" /> Process {stats.pending} files
              </button>
            )}
          </div>
        </div>

        {/* Uploaded File List */}
        {documents.length > 0 && (
          <div className="pt-4 border-t border-ypsom-alice animate-in fade-in slide-in-from-top-2">
            <h3 className="text-[10px] font-black uppercase text-ypsom-slate tracking-widest mb-3 flex items-center">
              <FileText className="w-3 h-3 mr-2" /> Document List ({documents.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {documents.map(doc => (
                <div key={doc.id} className={`group p-3 rounded-sm border flex items-center justify-between transition-all ${
                  doc.status === 'completed' ? 'bg-green-50 border-green-100' :
                  doc.status === 'processing' ? 'bg-ypsom-alice/20 border-ypsom-alice border-dashed' :
                  doc.status === 'error' ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-ypsom-alice'
                }`}>
                  <div className="flex items-center truncate mr-2">
                    {doc.status === 'completed' ? <CheckCircle className="w-3 h-3 text-green-600 mr-2 flex-shrink-0" /> :
                     doc.status === 'processing' ? <Loader2 className="w-3 h-3 text-ypsom-deep animate-spin mr-2 flex-shrink-0" /> :
                     doc.status === 'error' ? <XCircle className="w-3 h-3 text-red-600 mr-2 flex-shrink-0" /> :
                     <FileText className="w-3 h-3 text-ypsom-slate mr-2 flex-shrink-0" />}
                    <span className="text-[10px] font-bold text-ypsom-shadow truncate" title={doc.fileName}>{doc.fileName}</span>
                  </div>
                  {!isProcessing && doc.status !== 'completed' && (
                    <button onClick={() => removeFile(doc.id)} className="text-ypsom-slate hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {completed.length > 0 && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex justify-between items-center border-b border-ypsom-alice pb-3">
            <h2 className="text-xl font-bold text-ypsom-deep">Audit Ledger</h2>
            <div className="text-right">
              <p className="text-[10px] text-ypsom-slate uppercase font-bold">Audit Total ({reportingCurrency})</p>
              <p className="text-2xl font-mono font-bold text-ypsom-deep">{totalExpense.toLocaleString('en-CH', {minimumFractionDigits: 2})}</p>
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
                  if (doc.status !== 'completed' || !doc.data) return null;
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
                        <td className="px-3 py-4 font-mono">{doc.data.totalAmount.toFixed(2)} {doc.data.originalCurrency}</td>
                        <td className="px-3 py-4 font-mono text-ypsom-slate">{doc.data.vatAmount ? doc.data.vatAmount.toFixed(2) : '0.00'}</td>
                        <td className="px-3 py-4 text-right font-mono text-[9px]">{isForeign ? doc.data.conversionRateUsed?.toFixed(4) : '-'}</td>
                        <td className="px-3 py-4 text-right font-bold font-mono text-ypsom-deep bg-ypsom-alice/5">{doc.data.amountInCHF.toFixed(2)}</td>
                      </tr>
                      {isBank && isExpanded && doc.data.lineItems?.map((line, i) => (
                        <tr key={i} className="text-[10px] bg-gray-50/50">
                          <td className="px-3 py-2 border-l-4 border-ypsom-deep opacity-30 text-center">•</td>
                          <td className="px-3 py-2 opacity-60 font-mono">{line.date}</td>
                          <td className="px-3 py-2 italic font-medium" colSpan={3}>{line.description}</td>
                          <td className="px-3 py-2 text-right opacity-60 font-mono">{line.type === 'INCOME' ? `+${line.amount.toFixed(2)}` : `-${line.amount.toFixed(2)}`}</td>
                          <td className="px-3 py-2 text-right font-bold font-mono opacity-80">{line.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
             <button 
                onClick={() => exportToExcel(completed.map(d => d.data!), 'Ypsom_Full_Audit')} 
                className="flex items-center text-[10px] bg-ypsom-deep text-white px-8 py-3 rounded-sm shadow-sm hover:bg-ypsom-shadow font-bold uppercase tracking-widest"
             >
                <Download className="w-4 h-4 mr-2" /> Exhaustive Audit Export (.xlsx)
             </button>
          </div>
        </div>
      )}
    </div>
  );
};
