
import React, { useState } from 'react';
import { DocumentProcessor } from './components/DocumentProcessor';
import { FinancialInsights } from './components/FinancialInsights';
import { ShieldCheck, Sparkles, Zap, Eye, Wallet } from 'lucide-react';
import { ProcessedDocument } from './types';

function App() {
  const [processedDocuments, setProcessedDocuments] = useState<ProcessedDocument[]>([]);
  const [activeTab, setActiveTab] = useState<'audit' | 'insights'>('audit');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-white border-b border-ypsom-alice sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-ypsom-deep rounded-sm flex items-center justify-center mr-3">
                <span className="text-white font-bold text-sm font-serif italic">YP</span>
              </div>
              <div className="flex flex-col">
                <span className="font-black text-lg text-ypsom-deep tracking-wider leading-none">YPSOM <span className="font-light">PARTNERS</span></span>
                <span className="text-[0.55rem] tracking-[0.3em] text-ypsom-slate uppercase font-bold">Audit Intelligence</span>
              </div>
            </div>
            
            <nav className="flex items-center space-x-1">
              <button 
                onClick={() => setActiveTab('audit')}
                className={`px-4 py-2 rounded-sm text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'audit' ? 'bg-ypsom-deep text-white shadow-md' : 'text-ypsom-slate hover:bg-gray-100'}`}
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Audit Center
              </button>
              <button 
                onClick={() => setActiveTab('insights')}
                className={`px-4 py-2 rounded-sm text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'insights' ? 'bg-ypsom-deep text-white shadow-md' : 'text-ypsom-slate hover:bg-gray-100'}`}
              >
                <Sparkles className="w-3.5 h-3.5" /> Intelligence
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-10">
        <div className="mb-8 border-l-2 border-ypsom-deep pl-4">
           <h1 className="text-xl font-black text-ypsom-deep uppercase tracking-tighter">
               {activeTab === 'audit' ? 'Fiduciary Control Dashboard' : 'Financial Intelligence'}
           </h1>
           <p className="text-[11px] text-ypsom-slate mt-1 font-bold uppercase tracking-widest opacity-60">
             {activeTab === 'audit' 
                ? 'High-speed automated extraction for Swiss fiduciary audits.' 
                : 'Neural multi-modal analytics on audited datasets.'}
           </p>
        </div>

        <div className="w-full">
            {activeTab === 'audit' && <DocumentProcessor documents={processedDocuments} setDocuments={setProcessedDocuments} />}
            {activeTab === 'insights' && <FinancialInsights documents={processedDocuments} />}
        </div>
      </main>
      
      <footer className="bg-white py-6 border-t border-ypsom-alice">
        <div className="max-w-[1400px] mx-auto px-6 flex justify-between items-center text-ypsom-slate/40 text-[9px] uppercase font-black tracking-[0.3em]">
          <div>&copy; {new Date().getFullYear()} Ypsom Partners • Fiduciary Workforce v7.0</div>
          <div className="flex gap-6">
            <span className="flex items-center gap-1.5"><Zap className="w-3 h-3" /> Z2 Optimized</span>
            <span className="flex items-center gap-1.5"><Eye className="w-3 h-3" /> Forensic Trace</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
