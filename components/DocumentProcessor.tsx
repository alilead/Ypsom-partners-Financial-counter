import React, { useState, useRef, useMemo } from 'react';
import { Upload, CheckCircle, XCircle, Loader2, Download, Trash2, Coins, AlertCircle, X, FileUp, AlertTriangle, Zap, Clock, ExternalLink, Cpu } from 'lucide-react';
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
  const [activeWorkerCount, setActiveWorkerCount] = useState(0);
  const dragCounter = useRef(0);
  const stopProcessingRef = useRef(false);

  const stats = useMemo(() => {
    const total = documents.length;
    const completed = documents.filter(d => d.status === 'completed').length;
    const errors = documents.filter(d => d.status === 'error').length;
    const pending = documents.filter(d => d.status === 'pending' || d.status === 'processing').length;
    const processing = documents.filter(d => d.status === 'processing').length;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    
    // Improved time estimation for large batches
    // Assuming 18s per file average / 5 workers = 3.6s per file throughput
    const remainingCount = documents.filter(d => d.status === 'pending').length;
    const estRemainingSeconds = (remainingCount * 18) / 5;
    const minutes = Math.floor(estRemainingSeconds / 60);
    const seconds = Math.floor(estRemainingSeconds % 60);
    
    return { 
      total, completed, pending, progress, errors, processing,
      timeStr: remainingCount > 0 ? `${minutes}m ${seconds}s` : 'Finishing...' 
    };
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
      if (!isDuplicate) {
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

  const processAll = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    stopProcessingRef.current = false;
    
    const pendingIndices = documents
      .map((d, i) => (d.status === 'pending' || d.status === 'error') ? i : -1)
      .filter(i => i !== -1);

    if (pendingIndices.length === 0) {
      setIsProcessing(false);
      return;
    }

    const CONCURRENCY_LIMIT = 5;
    let indexInQueue = 0;
    const activeTasks = new Set<Promise<void>>();

    const runTask = async (docIndex: number) => {
      const doc = documents[docIndex];
      if (!doc || !doc.fileRaw || stopProcessingRef.current) return;

      setDocuments(prev => prev.map((d, i) => i === docIndex ? { ...d, status: 'processing', error: undefined } : d));
      setActiveWorkerCount(prev => prev + 1);

      try {
        const result = await analyzeFinancialDocument(doc.fileRaw, reportingCurrency);
        setDocuments(prev => prev.map((d, i) => i === docIndex ? { ...d, status: 'completed', data: result } : d));
      } catch (err: any) {
        setDocuments(prev => prev.map((d, i) => i === docIndex ? { ...d, status: 'error', error: err.message } : d));
        addNotification(`${doc.fileName}: ${err.message}`, 'error');
      } finally {
        setActiveWorkerCount(prev => Math.max(0, prev - 1));
      }
    };

    while (indexInQueue < pendingIndices.length && !stopProcessingRef.current) {
      while (activeTasks.size < CONCURRENCY_LIMIT && indexInQueue < pendingIndices.length) {
        const docIndex = pendingIndices[indexInQueue++];
        const task = runTask(docIndex).finally(() => activeTasks.delete(task));
        activeTasks.add(task);
      }
      if (activeTasks.size > 0) {
        await Promise.race(activeTasks);
      }
    }

    await Promise.all(activeTasks);
    setIsProcessing(false);
    setActiveWorkerCount(0);
  };

  return (
    <div 
      className={`space-y-6 relative transition-all duration-300 ${isDragging ? 'scale-[1.01]' : ''}`}
      onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setIsDragging(true); }}
      onDragLeave={() => { dragCounter.current--; if (dragCounter.current === 0) setIsDragging(false); }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); dragCounter.current = 0; if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files)); }}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-[60] bg-ypsom-deep/10 border-4 border-dashed border-ypsom-deep rounded-sm flex flex-col items-center justify-center backdrop-blur-[2px] pointer-events-none animate-in fade-in duration-200">
          <FileUp className="w-16 h-16 text-ypsom-deep mb-4 animate-bounce" />
          <p className="text-xl font-bold text-ypsom-deep uppercase tracking-widest">Release to Upload</p>
        </div>
      )}

      {/* Notifications */}
      <div className="fixed top-24 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        {notifications.map(n => (
          <div key={n.id} className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-sm shadow-xl border-l-4 animate-in slide-in-from-right duration-300 ${
            n.type === 'warning' ? 'bg-amber-50 border-amber-500 text-amber-800' :
            n.type === 'error' ? 'bg-red-50 border-red-500 text-red-800' : 'bg-green-50 border-green-500 text-green-800'
          }`}>
            <span className="text-xs font-bold">{n.message}</span>
            <button onClick={() => setNotifications(prev => prev.filter(notif => notif.id !== n.id))}><X className="w-3 h-3" /></button>
          </div>
        ))}
      </div>

      <div className="bg-white p-6 rounded-sm shadow-sm border border-ypsom-alice flex flex-col gap-6">
        {isProcessing && (
          <div className="bg-ypsom-deep/5 p-5 rounded-sm border border-ypsom-alice/50 space-y-4 shadow-inner">
            <div className="flex justify-between items-center">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-ypsom-deep rounded-sm animate-pulse">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-ypsom-deep uppercase tracking-widest block">Batch Analysis Active</span>
                    <span className="text-[9px] font-bold text-ypsom-slate uppercase tracking-wider">{activeWorkerCount} of 5 Workers Running</span>
                  </div>
               </div>
               <div className="text-right">
                  <div className="flex items-center gap-2 text-ypsom-slate justify-end">
                    <Clock className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{stats.timeStr} remaining</span>
                  </div>
                  <span className="text-[9px] font-black text-ypsom-deep/40 uppercase tracking-tighter mt-1 block">Batch: {stats.total} files</span>
               </div>
            </div>
            <div className="w-full h-2 bg-ypsom-alice rounded-full overflow-hidden">
              <div className="h-full bg-ypsom-deep transition-all duration-700 ease-out" style={{ width: `${stats.progress}%` }} />
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((w) => (
                <div key={w} className={`h-1 flex-1 rounded-full transition-colors duration-500 ${w <= activeWorkerCount ? 'bg-ypsom-deep animate-pulse' : 'bg-ypsom-alice'}`} />
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-full md:w-48">
            <label className="block text-[10px] font-bold text-ypsom-slate uppercase tracking-wider mb-2">Target Currency</label>
            <div className="relative">
              <select 
                value={reportingCurrency}
                onChange={(e) => setReportingCurrency(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-ypsom-alice rounded-sm bg-white text-sm font-bold text-ypsom-deep outline-none focus:ring-1 focus:ring-ypsom-deep appearance-none"
              >
                <option value="CHF">CHF</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
              <Coins className="w-4 h-4 text-ypsom-slate absolute left-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          <label className="flex-1 w-full flex flex-col items-center justify-center h-24 border-2 border-dashed border-ypsom-alice hover:bg-ypsom-alice/20 rounded-sm cursor-pointer transition-all group">
            <Upload className="w-5 h-5 mb-2 text-ypsom-slate group-hover:text-ypsom-deep transition-colors" />
            <p className="text-[10px] font-black uppercase tracking-widest text-ypsom-slate group-hover:text-ypsom-deep">Select Bulk Evidence (100+ files ok)</p>
            <input type="file" className="hidden" multiple accept="image/*,application/pdf" onChange={handleFileUpload} />
          </label>

          <button 
            onClick={processAll} 
            disabled={isProcessing || (stats.pending === 0 && stats.errors === 0)} 
            className="bg-ypsom-deep text-white px-10 py-3 rounded-sm font-bold text-xs uppercase tracking-widest shadow-md disabled:opacity-50 hover:bg-ypsom-shadow transition-all transform active:scale-95"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Analyzing...
              </span>
            ) : (
              `Run Audit (${stats.total})`
            )}
          </button>
        </div>

        {documents.length > 0 && (
          <div className="pt-4 border-t border-ypsom-alice">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-ypsom-slate mb-4 flex items-center gap-2">
              <Cpu className="w-3 h-3" /> Processing Queue
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {documents.map(doc => (
                <div key={doc.id} className={`p-3 rounded-sm border transition-all flex flex-col gap-1 ${
                  doc.status === 'error' ? 'bg-red-50 border-red-200' : 
                  doc.status === 'completed' ? 'bg-green-50 border-green-200' : 
                  doc.status === 'processing' ? 'bg-ypsom-alice/30 border-ypsom-deep/30' : 'bg-gray-50 border-ypsom-alice'
                }`}>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold truncate max-w-[80px]" title={doc.fileName}>{doc.fileName}</span>
                    {doc.status === 'processing' ? (
                      <Loader2 className="w-3 h-3 animate-spin text-ypsom-deep" />
                    ) : (
                      <button onClick={() => removeFile(doc.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-3 h-3 text-red-400 hover:text-red-600" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[8px] font-black uppercase tracking-tighter ${
                      doc.status === 'error' ? 'text-red-700' : 
                      doc.status === 'completed' ? 'text-green-700' : 
                      doc.status === 'processing' ? 'text-ypsom-deep' : 'text-ypsom-slate'
                    }`}>
                      {doc.status}
                    </span>
                    {doc.status === 'completed' && <CheckCircle className="w-2.5 h-2.5 text-green-600" />}
                    {doc.status === 'error' && <AlertTriangle className="w-2.5 h-2.5 text-red-600" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {stats.completed > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-end border-b border-ypsom-alice pb-3">
            <div>
              <h2 className="text-lg font-bold text-ypsom-deep uppercase tracking-widest">Audit Ledger</h2>
              <p className="text-[10px] text-ypsom-slate font-medium uppercase tracking-wider">{stats.completed} documents verified and grounded.</p>
            </div>
            <button onClick={() => exportToExcel(documents.filter(d => d.data).map(d => d.data!), 'Ypsom_Audit_Batch', reportingCurrency)} className="bg-ypsom-deep text-white px-6 py-2.5 rounded-sm font-bold text-[10px] uppercase tracking-widest shadow-md flex items-center hover:bg-ypsom-shadow transition-colors">
               <Download className="w-4 h-4 mr-2" /> Download Batch XLSX
            </button>
          </div>
          <div className="bg-white rounded-sm shadow-md border border-ypsom-alice overflow-hidden">
            <table className="min-w-full divide-y divide-ypsom-alice text-[11px]">
              <thead className="bg-ypsom-shadow text-white uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-4 text-left">Date</th>
                  <th className="px-4 py-4 text-left">Issuer</th>
                  <th className="px-4 py-4 text-right">Total ({reportingCurrency})</th>
                  <th className="px-4 py-4 text-left">Evidence Sources</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-ypsom-alice">
                {documents.filter(d => d.data).map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4 font-mono text-ypsom-slate">{doc.data!.date}</td>
                    <td className="px-4 py-4 font-bold text-ypsom-deep">{doc.data!.issuer}</td>
                    <td className="px-4 py-4 text-right font-bold font-mono text-ypsom-deep text-sm">{doc.data!.amountInCHF.toLocaleString('en-CH', {minimumFractionDigits: 2})}</td>
                    <td className="px-4 py-4">
                      {doc.data!.groundingUrls && doc.data!.groundingUrls.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {doc.data!.groundingUrls.slice(0, 2).map((url, i) => (
                            <a 
                              key={i} 
                              href={url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-ypsom-deep hover:text-ypsom-shadow flex items-center gap-1 transition-colors bg-ypsom-alice/30 px-2 py-0.5 rounded-full"
                            >
                              <ExternalLink className="w-2 h-2" />
                              <span className="text-[8px] font-black uppercase">Ref {i + 1}</span>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[9px] text-ypsom-slate italic uppercase opacity-40">Internal Only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
