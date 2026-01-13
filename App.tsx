
import React, { useState } from 'react';
import { DocumentProcessor } from './components/DocumentProcessor';
import { LayoutDashboard } from 'lucide-react';
import { ProcessedDocument } from './types';

function App() {
  const [processedDocuments, setProcessedDocuments] = useState<ProcessedDocument[]>([]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-ypsom-alice sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            {/* Logo Section */}
            <div className="flex items-center">
              <div className="w-10 h-10 bg-ypsom-deep rounded-sm flex items-center justify-center mr-3 shadow-sm">
                <span className="text-white font-bold text-xl font-serif italic">YP</span>
              </div>
              <div className="flex flex-col justify-center">
                <span className="font-bold text-2xl text-ypsom-deep tracking-widest leading-none">YPSOM <span className="font-light">PARTNERS</span></span>
                <span className="text-[0.65rem] tracking-[0.2em] text-ypsom-slate uppercase font-medium mt-1">Finance | Tax | Audit</span>
              </div>
            </div>
            
            <div className="hidden md:flex items-center space-x-4">
               <div className="text-right">
                 <p className="text-xs text-ypsom-slate font-medium">Internal System</p>
                 <p className="text-xs font-bold text-ypsom-deep">Universal Audit Engine v2.5</p>
               </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
           <div>
             <h1 className="text-2xl font-bold text-ypsom-deep flex items-center gap-2">
                 <LayoutDashboard className="w-6 h-6" /> Unified Audit Dashboard
             </h1>
             <p className="text-sm text-ypsom-slate mt-1">
               Upload any financial evidence. The engine automatically detects and reconciles Invoices, Receipts, and Bank Statements.
             </p>
           </div>
           <div className="bg-ypsom-alice/30 px-4 py-2 rounded-sm border border-ypsom-alice flex items-center gap-3">
              <div className="flex -space-x-2">
                <div className="w-6 h-6 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-[8px] text-white font-bold">INV</div>
                <div className="w-6 h-6 rounded-full bg-green-500 border-2 border-white flex items-center justify-center text-[8px] text-white font-bold">REC</div>
                <div className="w-6 h-6 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center text-[8px] text-white font-bold">BS</div>
              </div>
              <span className="text-[10px] font-bold text-ypsom-deep uppercase tracking-widest">Multi-Format Support Active</span>
           </div>
        </div>

        {/* Content Area */}
        <div className="w-full min-h-[500px] animate-in fade-in duration-300">
            <DocumentProcessor 
              documents={processedDocuments} 
              setDocuments={setProcessedDocuments} 
            />
        </div>

      </main>
      
      {/* Footer */}
      <footer className="bg-ypsom-darker py-6 mt-12 border-t border-ypsom-deep">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center text-ypsom-slate/60 text-xs">
          <div>&copy; {new Date().getFullYear()} Ypsom Partners. All rights reserved.</div>
          <div className="flex space-x-6">
            <span className="hover:text-ypsom-alice cursor-pointer transition-colors">Compliance</span>
            <span className="hover:text-ypsom-alice cursor-pointer transition-colors">Data Privacy</span>
            <span className="hover:text-ypsom-alice cursor-pointer transition-colors">Support</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
