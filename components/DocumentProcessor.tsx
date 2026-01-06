
import React, { useState, useRef, useMemo } from 'react';
import { Upload, CheckCircle, XCircle, Loader2, Download, Trash2, Coins, AlertCircle, X, FileUp, AlertTriangle } from 'lucide-react';
import { analyzeFinancialDocument } from '../services/geminiService';
import { exportToExcel } from '../services/excelService';
import { ProcessedDocument, DocumentType } from '../types';

interface Notification {
  id: string;
  message: string;
  type: 'warning' | 'error' | 'success';
}

interface DocumentProcessorProps {
  documents: ProcessedDocument[];
  setDocuments: React.Dispatch<React.SetStateAction<ProcessedDocument[]>>;
}

export const DocumentProcessor: React.FC<DocumentProcessorProps> = ({ documents, setDocuments }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [reportingCurrency, setReportingCurrency] = useState('CHF');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const stopProcessingRef = useRef(false);

  const stats = useMemo(() => {
    const total = documents.length;
    const completed = documents.filter(d => d.status === 'completed').length;
    const errors = documents.filter(d => d.status === 'error').length;
    const pending = documents.filter(d => d.status === 'pending').length;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    return { total, completed, pending, progress, errors };
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
        addNotification(`Duplicate file blocked: ${file.name}`, 'warning');
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
      } catch (err: any) {
        setDocuments(prev => prev.map((d, i) => i === index ? { ...d, status: 'error', error: err.message } : d));
        addNotification(`${doc.fileName}: ${err.message}`, 'error');
      }
    }
    setIsProcessing(false);
  };

  const completed = documents.filter(d => d.status === 'completed' && d.data);
  const totalExpense = completed.reduce((acc, doc) => {
    return acc + (doc.data?.amountInCHF || 0);
  }, 0);

  return (
    <div 
      className={`space-y-6 relative transition-all duration-300 ${isDragging ? 'scale-[1.01]' : ''}`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-[60] bg-ypsom-deep/10 border-4 border-dashed border-ypsom-deep rounded-sm flex flex-col items-center justify-center backdrop-blur-[2px] pointer-events-none animate-in fade-in duration-200">
          <FileUp className="w-16 h-16 text-ypsom-deep mb-4 animate-bounce" />
          <p className="text-xl font-bold text-ypsom-deep uppercase tracking-widest">Release to Upload Audit Evidence</p>
          <p className="text-sm text-ypsom-slate font-medium">Invoices, Receipts & Bank Statements</p>
        </div>
      )}

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
        {isProcessing && (
          <div className="w-full space-y-2 animate-in fade-in slide-in-from-top-2">
            <div className="flex justify-between text-[10px] font-black text-ypsom-slate uppercase tracking-[0.2em]">
              <span>Audit Processing...</span>
              <span>{Math.round(stats.progress)}%</span>
            </div>
            <div className="w-full h-1.5 bg-ypsom-alice rounded-full overflow-hidden">
              <div className="h-full bg-ypsom-deep transition-all duration-500 ease-out" style={{ width: `${stats.progress}%` }} />
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-full md:w-48">
            <label className="block text-[10px] font-bold text-ypsom-slate uppercase tracking-wider mb-2">Reporting Currency</label>
            <div className="relative">
              <select 
                value={reportingCurrency}
                onChange={(e) => setReportingCurrency(e.target.value)}
                disabled={isProcessing}
                className="w-full pl-8 pr-3 py-2 border border-ypsom-alice rounded-sm bg-white text-sm font-bold text-ypsom-deep outline-none focus:ring-1 focus:ring-ypsom-deep"
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
            className="flex-1 w-full group flex flex-col items-center justify-center h-24 border-2 border-dashed border-ypsom-alice hover:bg-ypsom-alice/20 rounded-sm cursor-pointer transition-all"
          >
            <Upload className="w-5 h-5 mb-2 text-ypsom-slate group-hover:text-ypsom-deep" />
            <p className="text-[10px] font-black uppercase tracking-widest text-ypsom-slate">Click or drag here to upload</p>
            <input type="file" className="hidden" multiple accept="image/*,application/pdf" onChange={handleFileUpload} />
          </label>

          <div className="flex gap-2 w-full md:w-auto">
            {isProcessing ? (
              <button onClick={() => { stopProcessingRef.current = true; setIsProcessing(false); }} className="bg-red-600 text-white px-8 py-3 rounded-sm font-bold text-xs uppercase tracking-widest shadow-md">
                Stop
              </button>
            ) : (
              <button onClick={processAll} disabled={stats.pending === 0 && stats.errors === 0} className="bg-ypsom-deep text-white px-8 py-3 rounded-sm font-bold text-xs uppercase tracking-widest shadow-md disabled:opacity-50">
                Run Audit ({stats.pending + stats.errors})
              </button>
            )}
          </div>
        </div>

        {documents.length > 0 && (
          <div className="pt-4 border-t border-ypsom-alice">
            <h3 className="text-[10px] font-black uppercase text-ypsom-slate tracking-widest mb-3">Audit Queue & Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {documents.map(doc => (
                <div 
                  key={doc.id} 
                  className={`p-3 rounded-sm border transition-all flex flex-col gap-2 ${
                    doc.status === 'error' ? 'bg-red-50 border-red-200' : 
                    doc.status === 'completed' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-ypsom-alice'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold truncate max-w-[120px]" title={doc.fileName}>{doc.fileName}</span>
                    <div className="flex items-center gap-1.5">
                      {doc.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin text-ypsom-deep" />}
                      {doc.status === 'error' && <AlertTriangle className="w-3 h-3 text-red-600" />}
                      {doc.status === 'completed' && <CheckCircle className="w-3 h-3 text-green-600" />}
                      {!isProcessing && <button onClick={() => removeFile(doc.id)} className="text-red-500 hover:text-red-700 ml-1"><Trash2 className="w-3 h-3" /></button>}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] font-black uppercase tracking-tighter ${
                      doc.status === 'error' ? 'text-red-700' : 
                      doc.status === 'completed' ? 'text-green-700' : 'text-ypsom-slate'
                    }`}>
                      {doc.status === 'error' ? 'Failed: 0.00 / Legibility' : 
                       doc.status === 'completed' ? 'Verified' : 
                       doc.status === 'processing' ? 'Extracting...' : 'Ready'}
                    </span>
                    {doc.status === 'error' && (
                      <span className="text-[8px] text-red-600 underline cursor-help" title={doc.error}>Details</span>
                    )}
                  </div>
                  
                  {doc.status === 'error' && (
                    <button 
                      onClick={() => removeFile(doc.id)} 
                      className="mt-1 text-[8px] font-bold bg-red-600 text-white py-1 px-2 rounded-sm text-center uppercase tracking-widest hover:bg-red-700 transition-colors"
                    >
                      Remove & Re-upload
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {completed.length > 0 && (
        <div className="space-y-6">
          <div className="flex justify-between items-center border-b border-ypsom-alice pb-3">
            <h2 className="text-lg font-bold text-ypsom-deep uppercase tracking-widest">Audit Ledger</h2>
            <div className="text-right">
              <p className="text-[9px] text-ypsom-slate uppercase font-black">Ledger Total</p>
              <p className="text-xl font-bold text-ypsom-deep font-mono">{totalExpense.toFixed(2)} {reportingCurrency}</p>
            </div>
          </div>

          <div className="bg-white rounded-sm shadow-md border border-ypsom-alice overflow-hidden">
            <table className="min-w-full divide-y divide-ypsom-alice text-[11px]">
              <thead className="bg-ypsom-shadow text-white font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-4 text-left">Date</th>
                  <th className="px-4 py-4 text-left">Issuer</th>
                  <th className="px-4 py-4 text-left">Original Amt</th>
                  <th className="px-4 py-4 text-left">VAT</th>
                  <th className="px-4 py-4 text-right">Ex. Rate</th>
                  <th className="px-4 py-4 text-right">Total ({reportingCurrency})</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-ypsom-alice">
                {documents.map((doc) => {
                  if (doc.status !== 'completed' || !doc.data) return null;
                  return (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 font-mono">{doc.data.date}</td>
                      <td className="px-4 py-4 font-bold text-ypsom-deep">{doc.data.issuer}</td>
                      <td className="px-4 py-4 font-mono">{doc.data.totalAmount.toFixed(2)} {doc.data.originalCurrency}</td>
                      <td className="px-4 py-4 font-mono text-ypsom-slate">{doc.data.vatAmount?.toFixed(2) || '0.00'}</td>
                      <td className="px-4 py-4 text-right font-mono">{doc.data.conversionRateUsed?.toFixed(4)}</td>
                      <td className="px-4 py-4 text-right font-bold font-mono text-ypsom-deep">{doc.data.amountInCHF.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div className="flex justify-end pt-4">
             <button onClick={() => exportToExcel(completed.map(d => d.data!), 'Ypsom_Audit', reportingCurrency)} className="bg-ypsom-deep text-white px-8 py-3 rounded-sm font-bold text-xs uppercase tracking-widest shadow-md flex items-center">
                <Download className="w-4 h-4 mr-2" /> Exhaustive Excel Export
             </button>
          </div>
        </div>
      )}
    </div>
  );
};
