import React, { useState, useMemo, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { ProcessedDocument, DocumentType, BankTransaction } from '../types';
import { MessageSquare, PieChart, Sparkles, Send, Loader2, Image as ImageIcon, X, Eye, AlertCircle, Camera } from 'lucide-react';
import { fileToBase64 } from '../services/geminiService';

interface FinancialInsightsProps {
  documents: ProcessedDocument[];
}

export const FinancialInsights: React.FC<FinancialInsightsProps> = ({ documents }) => {
  const [query, setQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model'; text: string; image?: string }[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const transactions = useMemo(() => {
    return documents
      .filter(d => d.status === 'completed' && d.data?.lineItems)
      .flatMap(d => d.data!.lineItems!) as BankTransaction[];
  }, [documents]);

  const stats = useMemo(() => {
    const income = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
    const byCategory = transactions.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);
    
    return { income, expense, net: income - expense, byCategory };
  }, [transactions]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleQuery = async () => {
    if ((!query.trim() && !selectedImage) || isAsking) return;
    
    const userMsg = query;
    const currentImage = selectedImage;
    const currentPreview = previewUrl;
    
    setQuery('');
    clearImage();
    
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg || (currentImage ? "[Visual Analysis Requested]" : ""), image: currentPreview || undefined }]);
    setIsAsking(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const context = JSON.stringify(transactions);
      
      const parts: any[] = [];
      if (currentImage) {
        const base64 = await fileToBase64(currentImage);
        parts.push({ inlineData: { mimeType: currentImage.type, data: base64 } });
      }
      
      const systemInstruction = `You are a professional financial planner and auditor. 
          The user's transaction data from processed documents is: ${context}.
          Analyze this data to answer queries about spending habits, monthly summaries, yearly outlooks, or specific records.
          If the user provides an image, perform visual forensic analysis: check for tampering, extract handwritten notes, or verify authenticity.
          Be precise, professional, and helpful. Use formatting for lists or tables in your response.`;

      parts.push({ text: userMsg || "Please analyze this image in the context of my financial records." });

      // Build history for the generateContent call
      const history = chatHistory.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));

      const response = await ai.models.generateContent({
        model: currentImage ? 'gemini-3-flash-preview' : 'gemini-3-pro-preview',
        contents: [
          ...history,
          { role: 'user', parts }
        ],
        config: {
          systemInstruction
        }
      });

      setChatHistory(prev => [...prev, { role: 'model', text: response.text || "I couldn't analyze that." }]);
    } catch (err: any) {
      setChatHistory(prev => [...prev, { role: 'model', text: `Error: ${err.message}` }]);
    } finally {
      setIsAsking(false);
    }
  };

  if (transactions.length === 0 && documents.filter(d => d.status === 'completed').length === 0) {
    return (
      <div className="p-12 text-center border-2 border-dashed border-ypsom-alice rounded-sm bg-white">
        <PieChart className="w-12 h-12 text-ypsom-slate mx-auto opacity-20 mb-4" />
        <h3 className="text-ypsom-deep font-bold uppercase text-xs tracking-widest">Awaiting Financial Data</h3>
        <p className="text-ypsom-slate text-xs mt-2">Upload bank statements or invoices in the Audit section to activate AI Insights.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-ypsom-deep p-6 rounded-sm text-white shadow-lg">
           <h3 className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-4">Account Health Overview</h3>
           <div className="space-y-4">
              <div className="flex justify-between items-center">
                 <span className="text-xs font-medium">Net Position</span>
                 <span className={`text-xl font-black font-mono ${stats.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                   {stats.net.toLocaleString()}
                 </span>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                 <div>
                    <p className="text-[8px] font-black uppercase opacity-60">Total Income</p>
                    <p className="text-sm font-bold text-green-400">+{stats.income.toLocaleString()}</p>
                 </div>
                 <div>
                    <p className="text-[8px] font-black uppercase opacity-60">Total Expenses</p>
                    <p className="text-sm font-bold text-red-400">-{stats.expense.toLocaleString()}</p>
                 </div>
              </div>
           </div>
        </div>

        <div className="bg-white p-6 rounded-sm border border-ypsom-alice shadow-sm">
           <h3 className="text-[10px] font-black uppercase tracking-widest text-ypsom-slate mb-4">Category Distribution</h3>
           <div className="space-y-3">
              {Object.entries(stats.byCategory).sort((a: [string, number], b: [string, number]) => b[1] - a[1]).map(([cat, val]) => {
                const categoryTotal: number = Number(val);
                const incomeTotal: number = Number(stats.income) || 1; // Avoid division by zero
                const widthPercentage = Math.min(100, (categoryTotal / incomeTotal) * 100);
                
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-[11px] mb-1">
                        <span className="font-bold text-ypsom-deep">{cat}</span>
                        <span className="font-mono">{categoryTotal.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-ypsom-deep" style={{ width: `${widthPercentage}%` }} />
                    </div>
                  </div>
                );
              })}
           </div>
        </div>

        <div className="bg-alice/10 p-5 rounded-sm border border-ypsom-alice flex items-start gap-4">
           <Eye className="w-5 h-5 text-ypsom-deep shrink-0 mt-1" />
           <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-ypsom-deep mb-1">Visual Forensics Enabled</p>
              <p className="text-[11px] text-ypsom-slate leading-relaxed">
                You can now upload images directly to the chat to analyze handwriting, check for tampering, or verify invoice details using Nano Banana vision intelligence.
              </p>
           </div>
        </div>
      </div>

      <div className="lg:col-span-2 flex flex-col bg-white rounded-sm border border-ypsom-alice shadow-xl overflow-hidden h-[700px]">
        <div className="p-4 bg-gray-50 border-b border-ypsom-alice flex items-center justify-between">
           <h3 className="text-[10px] font-black uppercase tracking-widest text-ypsom-slate flex items-center gap-2">
             <Sparkles className="w-4 h-4 text-ypsom-deep" /> AI Financial Intelligence Hub
           </h3>
           <span className="text-[9px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full uppercase tracking-tighter">Multi-Modal RAG Engine</span>
        </div>
        
        <div className="flex-1 p-6 overflow-y-auto space-y-6 custom-scrollbar bg-gray-50/30">
           {chatHistory.length === 0 && (
             <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                <MessageSquare className="w-8 h-8 mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">Ask anything or upload a document for visual analysis</p>
                <p className="text-[10px] italic mt-2">"Is this handwriting valid?" • "Summarize my spending" • "Find anomalies"</p>
             </div>
           )}
           {chatHistory.map((msg, i) => (
             <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-sm text-sm shadow-sm ${msg.role === 'user' ? 'bg-ypsom-deep text-white' : 'bg-white border border-ypsom-alice text-ypsom-deep'}`}>
                   {msg.image && (
                     <div className="mb-3 rounded-sm overflow-hidden border border-white/20">
                        <img src={msg.image} alt="Forensic Evidence" className="max-h-60 w-auto object-contain" />
                     </div>
                   )}
                   <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                </div>
             </div>
           ))}
           {isAsking && (
             <div className="flex justify-start">
                <div className="bg-white border border-ypsom-alice p-4 rounded-sm flex items-center gap-2">
                   <Loader2 className="w-4 h-4 animate-spin text-ypsom-deep" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-ypsom-slate">Processing multi-modal insights...</span>
                </div>
             </div>
           )}
        </div>

        <div className="p-4 bg-white border-t border-ypsom-alice">
           {previewUrl && (
             <div className="mb-3 flex items-center gap-3 p-2 bg-gray-50 rounded-sm border border-ypsom-alice w-fit animate-in slide-in-from-bottom-2">
                <div className="relative group">
                  <img src={previewUrl} className="w-12 h-12 object-cover rounded-sm" alt="Preview" />
                  <button 
                    onClick={clearImage}
                    className="absolute -top-2 -right-2 bg-red-600 text-white p-1 rounded-full shadow-lg hover:bg-red-700 transition-colors"
                  >
                    <X className="w-2 h-2" />
                  </button>
                </div>
                <div className="text-[10px] font-bold text-ypsom-slate uppercase tracking-widest">
                  Visual Forensic Evidence Selected
                </div>
             </div>
           )}
           <div className="relative flex items-center gap-2">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-3 bg-gray-100 text-ypsom-slate rounded-sm hover:bg-ypsom-alice transition-colors border border-ypsom-alice"
                title="Add visual forensic evidence"
              >
                <Camera className="w-5 h-5" />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                className="hidden" 
                accept="image/*" 
              />
              <input 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
                placeholder={selectedImage ? "Ask something about this document..." : "Query your financial records or analyze evidence..."}
                className="flex-1 px-4 py-3 bg-gray-50 border border-ypsom-alice rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ypsom-deep"
              />
              <button 
                onClick={handleQuery}
                disabled={(!query.trim() && !selectedImage) || isAsking}
                className="p-3 bg-ypsom-deep text-white rounded-sm hover:bg-ypsom-shadow transition-colors disabled:opacity-30 flex items-center justify-center min-w-[50px]"
              >
                {isAsking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};
