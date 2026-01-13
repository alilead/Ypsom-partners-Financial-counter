
import React, { useState, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { ProcessedDocument, DocumentType, BankTransaction } from '../types';
import { MessageSquare, PieChart, TrendingUp, TrendingDown, Sparkles, Send, Loader2, BarChart2 } from 'lucide-react';

interface FinancialInsightsProps {
  documents: ProcessedDocument[];
}

export const FinancialInsights: React.FC<FinancialInsightsProps> = ({ documents }) => {
  const [query, setQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [isAsking, setIsAsking] = useState(false);

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

  const handleQuery = async () => {
    if (!query.trim() || isAsking) return;
    const userMsg = query;
    setQuery('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsAsking(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const context = JSON.stringify(transactions);
      
      const chat = ai.chats.create({
        model: 'gemini-3-pro-preview',
        config: {
          systemInstruction: `You are a professional financial planner and auditor. 
          The user's transaction data is: ${context}.
          Analyze this data to answer queries about spending habits, monthly summaries, yearly outlooks, or specific records.
          Be precise, professional, and helpful. Use formatting for lists or tables in your response.`
        }
      });

      const response = await chat.sendMessage({ message: userMsg });
      setChatHistory(prev => [...prev, { role: 'model', text: response.text || "I couldn't analyze that." }]);
    } catch (err: any) {
      setChatHistory(prev => [...prev, { role: 'model', text: `Error: ${err.message}` }]);
    } finally {
      setIsAsking(false);
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="p-12 text-center border-2 border-dashed border-ypsom-alice rounded-sm bg-white">
        <PieChart className="w-12 h-12 text-ypsom-slate mx-auto opacity-20 mb-4" />
        <h3 className="text-ypsom-deep font-bold uppercase text-xs tracking-widest">Awaiting Financial Data</h3>
        <p className="text-ypsom-slate text-xs mt-2">Upload bank statements in the Audit section to activate AI Insights.</p>
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
              {Object.entries(stats.byCategory).sort((a,b) => b[1] - a[1]).map(([cat, val]) => {
                // Fix: Extract numeric values and perform arithmetic calculations outside the JSX block to resolve TS errors on arithmetic operations.
                const categoryTotal: number = Number(val);
                const incomeTotal: number = Number(stats.income);
                const widthPercentage = incomeTotal > 0 ? Math.min(100, (categoryTotal / incomeTotal) * 100) : 0;
                
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
      </div>

      <div className="lg:col-span-2 flex flex-col bg-white rounded-sm border border-ypsom-alice shadow-xl overflow-hidden h-[600px]">
        <div className="p-4 bg-gray-50 border-b border-ypsom-alice flex items-center justify-between">
           <h3 className="text-[10px] font-black uppercase tracking-widest text-ypsom-slate flex items-center gap-2">
             <Sparkles className="w-4 h-4 text-ypsom-deep" /> AI Financial Planner (Natural Language Query)
           </h3>
           <span className="text-[9px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">RAG ENGINE ACTIVE</span>
        </div>
        
        <div className="flex-1 p-6 overflow-y-auto space-y-4 custom-scrollbar bg-gray-50/30">
           {chatHistory.length === 0 && (
             <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                <MessageSquare className="w-8 h-8 mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">Ask anything about your finances</p>
                <p className="text-[10px] italic">"What was my biggest expense last month?" or "Summarize my salary vs rent."</p>
             </div>
           )}
           {chatHistory.map((msg, i) => (
             <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-sm text-sm shadow-sm ${msg.role === 'user' ? 'bg-ypsom-deep text-white' : 'bg-white border border-ypsom-alice text-ypsom-deep'}`}>
                   <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                </div>
             </div>
           ))}
           {isAsking && (
             <div className="flex justify-start">
                <div className="bg-white border border-ypsom-alice p-4 rounded-sm flex items-center gap-2">
                   <Loader2 className="w-4 h-4 animate-spin text-ypsom-deep" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-ypsom-slate">Analyzing Statements...</span>
                </div>
             </div>
           )}
        </div>

        <div className="p-4 bg-white border-t border-ypsom-alice">
           <div className="relative">
              <input 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
                placeholder="Query your financial records..."
                className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-ypsom-alice rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-ypsom-deep"
              />
              <button 
                onClick={handleQuery}
                disabled={!query.trim() || isAsking}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-ypsom-deep text-white rounded-sm hover:bg-ypsom-shadow transition-colors disabled:opacity-30"
              >
                <Send className="w-4 h-4" />
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};
