import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Loader2, Download, RefreshCcw, Receipt, Landmark, FileDigit, PieChart, Sparkles, Square, StopCircle } from 'lucide-react';
import { analyzeFinancialDocument, generateFinancialSummary } from '../services/geminiService';
import { exportToExcel } from '../services/excelService';
import { ProcessedDocument, DocumentType, FinancialData } from '../types';

interface IssuerStat {
  count: number;
  total: number;
}

export const DocumentProcessor: React.FC = () => {
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  
  // Ref to control the processing loop
  const stopProcessingRef = useRef(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files).map((file: File) => ({
        id: Math.random().toString(36).substr(2, 9),
        fileName: file.name,
        status: 'pending' as const,
        fileRaw: file
      }));
      setDocuments(prev => [...prev, ...newFiles]);
      // Reset summary when new files are added as context changes
      setSummary(null);
    }
  };

  const processAll = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    stopProcessingRef.current = false;
    
    const pendingDocs = documents.filter(d => d.status === 'pending' || d.status === 'error');
    
    // Process sequentially
    for (const doc of pendingDocs) {
      // Check stop signal
      if (stopProcessingRef.current) {
        break;
      }

      if (!doc.fileRaw) continue;
      
      // Update status to processing
      setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'processing', error: undefined } : d));
      
      try {
        const result = await analyzeFinancialDocument(doc.fileRaw);
        setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'completed', data: result } : d));
      } catch (err: any) {
        setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'error', error: err.message || "Analysis failed" } : d));
      }
    }
    
    setIsProcessing(false);
  };

  const handleStop = () => {
    stopProcessingRef.current = true;
  };

  const handleGenerateSummary = async () => {
    const completedData = documents
      .filter(d => d.status === 'completed' && d.data)
      .map(d => d.data!);
    
    if (completedData.length === 0) return;

    setIsGeneratingSummary(true);
    try {
      const text = await generateFinancialSummary(completedData);
      setSummary(text);
    } catch (e) {
      console.error(e);
      setSummary("Failed to generate summary.");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const completedDocs = documents.filter(d => d.status === 'completed' && d.data);
  const bankStatements = completedDocs.filter(d => d.data?.documentType === DocumentType.BANK_STATEMENT).map(d => d.data!);
  const invoices = completedDocs.filter(d => d.data?.documentType === DocumentType.INVOICE).map(d => d.data!);
  const receipts = completedDocs.filter(d => d.data?.documentType === DocumentType.RECEIPT).map(d => d.data!);

  // Calculate totals
  const totalValueCHF = completedDocs.reduce((acc, doc) => acc + (doc.data?.amountInCHF || 0), 0);

  // Group by Issuer
  const issuerStats = completedDocs.reduce<Record<string, IssuerStat>>((acc, doc) => {
    const issuer = doc.data?.issuer || 'Unknown';
    if (!acc[issuer]) {
      acc[issuer] = { count: 0, total: 0 };
    }
    acc[issuer].count += 1;
    acc[issuer].total += doc.data?.amountInCHF || 0;
    return acc;
  }, {});

  const sortedIssuers = (Object.entries(issuerStats) as [string, IssuerStat][]).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="space-y-6">
      {/* Input Zone */}
      <div className="bg-white p-8 rounded-sm shadow-sm border border-ypsom-alice">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex-1 w-full">
                <label 
                    htmlFor="file-upload" 
                    className="group flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-ypsom-alice rounded-sm cursor-pointer hover:bg-ypsom-alice/20 hover:border-ypsom-slate transition-all duration-300"
                >
                    <div className="flex flex-col items-center justify-center pt-2 pb-3">
                        <Upload className="w-8 h-8 text-ypsom-slate mb-3 group-hover:text-ypsom-deep transition-colors" />
                        <p className="mb-1 text-sm text-ypsom-shadow font-medium">Drop financial documents here</p>
                        <p className="text-xs text-ypsom-slate">Support for PDF & Images (Receipts, Invoices, Statements)</p>
                    </div>
                    <input 
                        id="file-upload" 
                        type="file" 
                        className="hidden" 
                        multiple 
                        accept="image/*,application/pdf"
                        onChange={handleFileUpload} 
                    />
                </label>
            </div>
            
            {/* Actions */}
            <div className="w-full md:w-auto flex flex-col gap-3 min-w-[200px]">
                 <div className="p-4 bg-gray-50 border border-ypsom-alice rounded-sm">
                    <p className="text-xs text-ypsom-slate uppercase tracking-wider font-semibold">Total Documents</p>
                    <p className="text-2xl font-bold text-ypsom-deep">{documents.length}</p>
                 </div>
                 
                 {isProcessing ? (
                   <button 
                      onClick={handleStop} 
                      className="flex items-center justify-center px-6 py-3 rounded-sm text-white font-medium transition-all shadow-sm bg-red-600 hover:bg-red-700 hover:shadow-md"
                   >
                      <StopCircle className="w-4 h-4 mr-2" /> Stop Processing
                   </button>
                 ) : (
                   <button 
                      onClick={processAll} 
                      disabled={documents.length === 0 || documents.every(d => d.status === 'completed')}
                      className={`flex items-center justify-center px-6 py-3 rounded-sm text-white font-medium transition-all shadow-sm ${
                      documents.length === 0
                          ? 'bg-ypsom-slate cursor-not-allowed opacity-70' 
                          : 'bg-ypsom-deep hover:bg-ypsom-shadow hover:shadow-md'
                      }`}
                  >
                      <RefreshCcw className="w-4 h-4 mr-2" /> Process Queue
                  </button>
                 )}
            </div>
          </div>
      </div>

      {/* Processing Queue List (Compact) */}
      {documents.length > 0 && (
          <div className="bg-white rounded-sm shadow-sm border border-ypsom-alice overflow-hidden">
             <div className="px-6 py-3 border-b border-ypsom-alice bg-gray-50 flex justify-between items-center">
                 <h3 className="text-xs font-bold text-ypsom-slate uppercase tracking-wider">Processing Queue</h3>
                 <span className="text-xs text-ypsom-slate">{documents.filter(d => d.status === 'completed').length} / {documents.length} Done</span>
             </div>
             <ul className="divide-y divide-ypsom-alice max-h-48 overflow-y-auto">
                {documents.map((doc) => (
                  <li key={doc.id} className="px-6 py-2 flex items-center justify-between text-xs hover:bg-gray-50 transition-colors">
                    <div className="flex items-center truncate">
                      <FileText className="w-4 h-4 mr-3 text-ypsom-slate flex-shrink-0" />
                      <span className="truncate text-ypsom-shadow font-medium max-w-md">{doc.fileName}</span>
                    </div>
                    <div className="flex items-center flex-shrink-0 ml-4">
                      {doc.status === 'pending' && <span className="text-ypsom-slate bg-ypsom-alice/50 px-2 py-0.5 rounded-sm">Pending</span>}
                      {doc.status === 'processing' && <span className="text-ypsom-deep flex items-center"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Analyzing</span>}
                      {doc.status === 'completed' && <span className="text-green-700 flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> {doc.data?.documentType}</span>}
                      {doc.status === 'error' && <span className="text-red-600 flex items-center"><XCircle className="w-3 h-3 mr-1" /> Failed</span>}
                    </div>
                  </li>
                ))}
             </ul>
          </div>
      )}

      {/* Results Dashboard */}
      {completedDocs.length > 0 && (
        <div className="space-y-6 animate-in fade-in duration-500 pt-4">
          
          <div className="flex flex-col md:flex-row items-center justify-between border-b border-ypsom-alice pb-2 mb-4 gap-4">
             <div className="flex items-center gap-4">
               <h2 className="text-xl font-bold text-ypsom-deep">Executive Summary</h2>
               <button 
                  onClick={handleGenerateSummary}
                  disabled={isGeneratingSummary}
                  className="flex items-center text-xs bg-ypsom-alice/30 hover:bg-ypsom-alice/50 text-ypsom-deep font-bold py-1.5 px-3 rounded-full transition-colors border border-ypsom-alice"
               >
                 {isGeneratingSummary ? (
                   <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                 ) : (
                   <Sparkles className="w-3 h-3 mr-1" />
                 )}
                 {summary ? "Regenerate Summary" : "Generate AI Summary"}
               </button>
             </div>
             <div className="text-right">
                <p className="text-xs text-ypsom-slate uppercase">Total Processed Value</p>
                <p className="text-xl font-mono font-bold text-ypsom-deep">{totalValueCHF.toFixed(2)} CHF</p>
             </div>
          </div>

          {/* Summary Box */}
          {summary && (
            <div className="bg-gradient-to-r from-ypsom-alice/20 to-transparent p-6 rounded-sm border-l-4 border-ypsom-deep animate-in slide-in-from-top-2">
              <h3 className="text-sm font-bold text-ypsom-deep mb-2 flex items-center">
                <Sparkles className="w-4 h-4 mr-2 text-ypsom-slate" /> AI Analysis
              </h3>
              <p className="text-sm text-ypsom-shadow leading-relaxed">
                {summary}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard 
              title="Bank Statements" 
              count={bankStatements.length} 
              onExport={() => exportToExcel(bankStatements, DocumentType.BANK_STATEMENT)}
              icon={Landmark}
              color="deep"
            />
            <StatCard 
              title="Invoices" 
              count={invoices.length} 
              onExport={() => exportToExcel(invoices, DocumentType.INVOICE)}
              icon={FileDigit}
              color="slate"
            />
            <StatCard 
              title="Receipts" 
              count={receipts.length} 
              onExport={() => exportToExcel(receipts, DocumentType.RECEIPT)}
              icon={Receipt}
              color="shadow"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Classification by Issuer Table */}
            <div className="bg-white rounded-sm shadow-sm border border-ypsom-alice overflow-hidden">
                <div className="px-6 py-4 border-b border-ypsom-alice bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center">
                        <PieChart className="w-4 h-4 mr-2 text-ypsom-deep" />
                        <h3 className="font-bold text-ypsom-deep text-sm">Expenses by Issuer</h3>
                    </div>
                </div>
                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                    <table className="min-w-full divide-y divide-ypsom-alice text-xs">
                        <thead className="bg-ypsom-alice/30">
                            <tr>
                                <th className="px-6 py-3 text-left font-bold text-ypsom-deep uppercase tracking-wider">Issuer</th>
                                <th className="px-6 py-3 text-center font-bold text-ypsom-deep uppercase tracking-wider">Count</th>
                                <th className="px-6 py-3 text-right font-bold text-ypsom-deep uppercase tracking-wider">Total (CHF)</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-ypsom-alice">
                            {sortedIssuers.map(([issuer, stats]) => (
                                <tr key={issuer} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-3 whitespace-nowrap text-ypsom-shadow font-medium">{issuer}</td>
                                    <td className="px-6 py-3 whitespace-nowrap text-center text-ypsom-slate">{stats.count}</td>
                                    <td className="px-6 py-3 whitespace-nowrap text-right text-ypsom-deep font-bold font-mono">
                                        {stats.total.toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detailed Document Table (Consolidated) */}
            <div className="bg-white rounded-sm shadow-sm border border-ypsom-alice overflow-hidden">
                <div className="px-6 py-4 border-b border-ypsom-alice bg-gray-50">
                    <h3 className="font-bold text-ypsom-deep text-sm">Recent Transactions</h3>
                </div>
                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                    <table className="min-w-full divide-y divide-ypsom-alice text-xs">
                        <thead className="bg-ypsom-alice/30">
                            <tr>
                                <th className="px-4 py-3 text-left font-bold text-ypsom-deep uppercase tracking-wider">Date</th>
                                <th className="px-4 py-3 text-left font-bold text-ypsom-deep uppercase tracking-wider">Issuer</th>
                                <th className="px-4 py-3 text-right font-bold text-ypsom-deep uppercase tracking-wider">Amount (CHF)</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-ypsom-alice">
                            {completedDocs.slice(0, 10).map((doc) => (
                                <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap text-ypsom-slate">{doc.data?.date}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-ypsom-shadow font-medium truncate max-w-[120px]">{doc.data?.issuer}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right text-ypsom-deep font-mono">
                                        {doc.data?.amountInCHF.toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface StatCardProps {
  title: string;
  count: number;
  onExport: () => void;
  icon: React.ElementType;
  color: 'deep' | 'slate' | 'shadow';
}

const StatCard: React.FC<StatCardProps> = ({ title, count, onExport, icon: Icon, color }) => {
  const colorStyles = {
    deep: {
        border: 'border-t-ypsom-deep',
        text: 'text-ypsom-deep',
        bg: 'bg-ypsom-deep'
    },
    slate: {
        border: 'border-t-ypsom-slate',
        text: 'text-ypsom-slate',
        bg: 'bg-ypsom-slate'
    },
    shadow: {
        border: 'border-t-ypsom-shadow',
        text: 'text-ypsom-shadow',
        bg: 'bg-ypsom-shadow'
    }
  };

  const style = colorStyles[color];

  return (
    <div className={`p-5 rounded-sm bg-white shadow-sm border border-ypsom-alice border-t-4 ${style.border} flex flex-col justify-between hover:shadow-md transition-shadow`}>
      <div className="flex justify-between items-start mb-4">
        <div>
            <p className="text-xs font-bold text-ypsom-slate uppercase tracking-wider mb-1">{title}</p>
            <p className={`text-3xl font-bold ${style.text}`}>{count}</p>
        </div>
        <div className={`p-2 rounded-full bg-gray-50 ${style.text}`}>
            <Icon className="w-5 h-5 opacity-80" />
        </div>
      </div>
      <button 
        onClick={onExport}
        disabled={count === 0}
        className={`w-full flex items-center justify-center py-2 px-4 rounded-sm text-xs font-bold uppercase tracking-wide transition-colors ${count === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : `${style.bg} text-white hover:opacity-90`}`}
      >
        <Download className="w-3 h-3 mr-2" /> Export XLS
      </button>
    </div>
  );
};
