import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Loader2, Download, RefreshCcw, Receipt, Landmark, FileDigit, PieChart, Sparkles, StopCircle, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Link as LinkIcon } from 'lucide-react';
import { analyzeFinancialDocument, generateFinancialSummary, reconcileDocuments } from '../services/geminiService';
import { exportToExcel } from '../services/excelService';
import { ProcessedDocument, DocumentType, FinancialData, BankTransaction } from '../types';

interface StatCardProps {
  title: string; count: number; onExport: () => void; icon: React.ElementType; color: 'deep' | 'slate' | 'shadow';
}

const StatCard: React.FC<StatCardProps> = ({ title, count, onExport, icon: Icon, color }) => {
  const borderColors = { deep: 'border-l-ypsom-deep', slate: 'border-l-ypsom-slate', shadow: 'border-l-ypsom-shadow' };
  const iconColors = { deep: 'text-ypsom-deep', slate: 'text-ypsom-slate', shadow: 'text-ypsom-shadow' };
  return (
    <div className={`bg-white p-4 rounded-sm shadow-sm border border-ypsom-alice border-l-4 ${borderColors[color]} flex flex-col justify-between`}>
      <div className="flex justify-between items-start mb-2">
        <div><p className="text-xs font-bold text-ypsom-slate uppercase tracking-wider">{title}</p><p className="text-2xl font-bold text-ypsom-deep mt-1">{count}</p></div>
        <div className="p-2 rounded-full bg-ypsom-alice/20"><Icon className={`w-5 h-5 ${iconColors[color]}`} /></div>
      </div>
      <button onClick={onExport} disabled={count === 0} className="text-xs font-bold text-ypsom-deep hover:text-ypsom-shadow flex items-center mt-2 disabled:opacity-50 transition-colors">
        <Download className="w-3 h-3 mr-1" /> Export Data
      </button>
    </div>
  );
};

export const DocumentProcessor: React.FC = () => {
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const stopProcessingRef = useRef(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files).map((file: File) => ({
        id: Math.random().toString(36).substr(2, 9), fileName: file.name, status: 'pending' as const, fileRaw: file
      }));
      setDocuments(prev => [...prev, ...newFiles]);
      setSummary(null);
    }
  };

  const processAll = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    stopProcessingRef.current = false;
    const pendingDocs = documents.filter(d => d.status === 'pending' || d.status === 'error');
    for (const doc of pendingDocs) {
      if (stopProcessingRef.current) break;
      if (!doc.fileRaw) continue;
      setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'processing' } : d));
      try {
        const result = await analyzeFinancialDocument(doc.fileRaw);
        setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'completed', data: result } : d));
      } catch (err: any) {
        setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'error', error: err.message } : d));
      }
    }
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
    setExpandedDocs(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const handleGenerateSummary = async () => {
    const data = documents.filter(d => d.status === 'completed' && d.data).map(d => d.data!);
    if (data.length === 0) return;
    setIsGeneratingSummary(true);
    try { const text = await generateFinancialSummary(data); setSummary(text); } finally { setIsGeneratingSummary(false); }
  };

  const completed = documents.filter(d => d.status === 'completed' && d.data);
  const totalValue = completed.reduce((acc, doc) => acc + (doc.data?.amountInCHF || 0), 0);

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-sm shadow-sm border border-ypsom-alice flex flex-col md:flex-row items-center justify-between gap-8">
        <label className="flex-1 w-full group flex flex-col items-center justify-center h-40 border-2 border-dashed border-ypsom-alice rounded-sm cursor-pointer hover:bg-ypsom-alice/20 transition-all">
          <Upload className="w-8 h-8 text-ypsom-slate mb-3 group-hover:text-ypsom-deep transition-colors" />
          <p className="text-sm font-medium">Upload Bank Statement + Support Receipts</p>
          <input type="file" className="hidden" multiple accept="image/*,application/pdf" onChange={handleFileUpload} />
        </label>
        <div className="w-full md:w-auto flex flex-col gap-3 min-w-[200px]">
          <div className="p-4 bg-gray-50 border border-ypsom-alice rounded-sm text-center">
            <p className="text-xs text-ypsom-slate uppercase font-bold">Files in Batch</p>
            <p className="text-2xl font-bold text-ypsom-deep">{documents.length}</p>
          </div>
          <button onClick={processAll} disabled={isProcessing} className="bg-ypsom-deep text-white px-6 py-3 rounded-sm font-medium hover:bg-ypsom-shadow transition-all">
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : <RefreshCcw className="w-4 h-4 inline mr-2" />} Analyze Batch
          </button>
        </div>
      </div>

      {completed.length > 0 && (
        <div className="space-y-6 animate-in fade-in">
          <div className="flex justify-between items-center border-b border-ypsom-alice pb-2">
            <div className="flex gap-4">
              <h2 className="text-xl font-bold text-ypsom-deep">Reconciled Batch</h2>
              {!isProcessing && (
                <button onClick={handleReconcile} className="text-xs font-bold text-ypsom-deep flex items-center bg-ypsom-alice/30 px-3 py-1.5 rounded-full border border-ypsom-alice">
                  <LinkIcon className="w-3 h-3 mr-1" /> Reconcile Attachments
                </button>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-ypsom-slate uppercase">Net CHF Value</p>
              <p className="text-xl font-mono font-bold text-ypsom-deep">{totalValue.toFixed(2)}</p>
            </div>
          </div>

          <div className="bg-white rounded-sm shadow-sm border border-ypsom-alice overflow-hidden">
            <table className="min-w-full divide-y divide-ypsom-alice text-[11px]">
              <thead className="bg-ypsom-alice/20 font-bold uppercase text-ypsom-deep">
                <tr>
                  <th className="px-3 py-3 w-8"></th>
                  <th className="px-3 py-3 text-left">Date</th>
                  <th className="px-3 py-3 text-left">Document / Ref</th>
                  <th className="px-3 py-3 text-right">Income</th>
                  <th className="px-3 py-3 text-right">Expense</th>
                  <th className="px-3 py-3 text-right">CHF Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-ypsom-alice">
                {completed.map((doc) => {
                  const isBank = doc.data?.documentType === DocumentType.BANK_STATEMENT;
                  const isExpanded = expandedDocs.has(doc.id);
                  return (
                    <React.Fragment key={doc.id}>
                      <tr onClick={() => isBank && toggleExpand(doc.id)} className={`${isBank ? 'bg-ypsom-alice/10 font-bold cursor-pointer' : 'hover:bg-gray-50'}`}>
                        <td className="px-3 py-3 text-center">{isBank && (isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{doc.data?.date}</td>
                        <td className="px-3 py-3">
                          <span className="flex items-center">
                            {doc.data?.issuer} {doc.data?.handwrittenRef && <span className="ml-2 bg-yellow-100 text-yellow-800 px-1 rounded font-bold">{doc.data.handwrittenRef}</span>}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-green-700">
                          {isBank ? doc.data?.lineItems?.filter(l => l.type === 'INCOME').reduce((s,l) => s+l.amount, 0).toFixed(2) : ''}
                        </td>
                        <td className="px-3 py-3 text-right text-red-700">
                          {!isBank ? doc.data?.totalAmount.toFixed(2) : doc.data?.lineItems?.filter(l => l.type === 'EXPENSE').reduce((s,l) => s+l.amount, 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-3 text-right font-bold bg-ypsom-alice/5">{doc.data?.amountInCHF.toFixed(2)}</td>
                      </tr>
                      {isBank && isExpanded && doc.data?.lineItems?.map((line, i) => (
                        <tr key={i} className="bg-gray-50/50 text-[10px]">
                          <td className="px-3 py-2 border-l-2 border-ypsom-deep"></td>
                          <td className="px-3 py-2 opacity-60">{line.date}</td>
                          <td className="px-3 py-2 italic flex items-center">
                             {line.supportingDocRef && <span className="mr-2 bg-ypsom-alice px-1 rounded-full font-bold">{line.supportingDocRef}</span>}
                             {line.description}
                          </td>
                          <td className="px-3 py-2 text-right text-green-700">{line.type === 'INCOME' ? line.amount.toFixed(2) : ''}</td>
                          <td className="px-3 py-2 text-right text-red-700">{line.type === 'EXPENSE' ? line.amount.toFixed(2) : ''}</td>
                          <td className="px-3 py-2 text-right opacity-60">{line.amount.toFixed(2)}</td>
                        </tr>
                      ))}
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
