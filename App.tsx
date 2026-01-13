
import React, { useState } from 'react';
import { DocumentProcessor } from './components/DocumentProcessor';
import { FinancialInsights } from './components/FinancialInsights';
import { LayoutDashboard, ShieldCheck, Sparkles } from 'lucide-react';
import { ProcessedDocument } from './types';

function App() {
  const [processedDocuments, setProcessedDocuments] = useState<ProcessedDocument[]>([]);
  const [activeTab, setActiveTab] = useState<'audit' | 'insights'>('audit');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-white border-b border-ypsom-alice sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-ypsom-deep rounded-sm flex items-center justify-center mr-3 shadow-sm">
                <span className="text-white font-bold text-xl font-serif italic">YP</span>
              </div>
              <div className="flex flex-col justify-center">
                <span className="font-bold text-2xl text-ypsom-deep tracking-widest leading-none">YPSOM <span className="font-light">PARTNERS</span></span>
                <span className="text-[0.65rem] tracking-[0.2em] text-ypsom-slate uppercase font-medium mt-1">Finance | Tax | Audit</span>
              </div>
            </div>
            
            <nav className="flex items-center space-x-1">
              <button 
                onClick={() => setActiveTab('audit')}
                className={`px-4 py-2 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'audit' ? 'bg-ypsom-deep text-white' : 'text-ypsom-slate hover:bg-ypsom-alice/50'}`}
              >
                <ShieldCheck className="w-4 h-4" /> Evidence Audit
              </button>
              <button 
                onClick={() => setActiveTab('insights')}
                className={`px-4 py-2 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'insights' ? 'bg-ypsom-deep text-white' : 'text-ypsom-slate hover:bg-ypsom-alice/50'}`}
              >
                <Sparkles className="w-4 h-4" /> AI Insights
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
           <h1 className="text-2xl font-bold text-ypsom-deep flex items-center gap-2 uppercase tracking-tight">
               {activeTab === 'audit' ? 'Unified Audit Dashboard' : 'Financial Intelligent Planner'}
           </h1>
           <p className="text-sm text-ypsom-slate mt-1">
             {activeTab === 'audit' 
               ? 'Convert unstructured bank statements and invoices into verified financial data.' 
               : 'Leverage LLM Nature Language to query records and analyze monthly/yearly planning.'}
           </p>
        </div>

        <div className="w-full animate-in fade-in duration-300">
            {activeTab === 'audit' ? (
              <DocumentProcessor 
                documents={processedDocuments} 
                setDocuments={setProcessedDocuments} 
              />
            ) : (
              <FinancialInsights documents={processedDocuments} />
            )}
        </div>
      </main>
      
      <footer className="bg-ypsom-darker py-6 mt-12 border-t border-ypsom-deep">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center text-ypsom-slate/40 text-[10px] uppercase font-bold tracking-widest">
          <div>&copy; {new Date().getFullYear()} Ypsom Partners • Advanced Audit Engine v3.0</div>
          <div className="flex space-x-6">
            <span>LLM-Based Extraction</span>
            <span>RAG-Optimized</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
