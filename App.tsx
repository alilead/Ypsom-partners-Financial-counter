import React, { useState } from 'react';
import { DocumentProcessor } from './components/DocumentProcessor';
import { BankStatementAnalyzer } from './components/BankStatementAnalyzer';
import { NanoBananaEditor } from './components/NanoBananaEditor';
import { LayoutDashboard, Wallet, Image as ImageIcon } from 'lucide-react';

type View = 'invoices' | 'bank' | 'images';

function App() {
  const [currentView, setCurrentView] = useState<View>('invoices');

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
                 <p className="text-xs font-bold text-ypsom-deep">Authorized Personnel Only</p>
               </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-ypsom-alice">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <nav className="flex space-x-8 -mb-px">
                  <button 
                    onClick={() => setCurrentView('invoices')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                        currentView === 'invoices' 
                        ? 'border-ypsom-deep text-ypsom-deep' 
                        : 'border-transparent text-ypsom-slate hover:text-ypsom-shadow hover:border-ypsom-alice'
                    }`}
                  >
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Invoices & Receipts
                  </button>
                  <button 
                    onClick={() => setCurrentView('bank')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                        currentView === 'bank' 
                        ? 'border-ypsom-deep text-ypsom-deep' 
                        : 'border-transparent text-ypsom-slate hover:text-ypsom-shadow hover:border-ypsom-alice'
                    }`}
                  >
                      <Wallet className="w-4 h-4 mr-2" />
                      Bank Statements
                  </button>
                  <button 
                    onClick={() => setCurrentView('images')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                        currentView === 'images' 
                        ? 'border-ypsom-deep text-ypsom-deep' 
                        : 'border-transparent text-ypsom-slate hover:text-ypsom-shadow hover:border-ypsom-alice'
                    }`}
                  >
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Asset Editor
                  </button>
              </nav>
          </div>
      </div>

      {/* Main Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="mb-8">
           <h1 className="text-2xl font-bold text-ypsom-deep">
               {currentView === 'invoices' && "Invoice Processing"}
               {currentView === 'bank' && "Statement Analysis"}
               {currentView === 'images' && "Creative Asset Studio"}
           </h1>
           <p className="text-sm text-ypsom-slate mt-1">
             {currentView === 'invoices' && "Classify and extract data from invoices and receipts."}
             {currentView === 'bank' && "Analyze cash flow, calculate totals, and export transaction ledgers."}
             {currentView === 'images' && "Modify and enhance visual assets using GenAI."}
           </p>
        </div>

        {/* Content Area */}
        <div className="w-full min-h-[500px] animate-in fade-in duration-300">
            {currentView === 'invoices' && <DocumentProcessor />}
            {currentView === 'bank' && <BankStatementAnalyzer />}
            {currentView === 'images' && <NanoBananaEditor />}
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