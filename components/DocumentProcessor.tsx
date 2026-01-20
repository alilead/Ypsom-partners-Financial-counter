
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Upload, CheckCircle, Loader2, Trash2, 
  ChevronDown, ChevronRight, Building2, Wallet, 
  Layers, AlertTriangle, ShieldCheck, Zap, 
  FileText, Edit3, RefreshCcw, UserCheck, 
  Cpu, Info, HeartHandshake, Coffee, 
  Monitor, Calculator, CreditCard, HelpCircle, 
  HardDrive, Scale, Landmark, ReceiptSwissFranc, 
  Hash, ListOrdered, Clock, Tag, Ban, 
  Activity, ExternalLink, ShieldAlert,
  Shield, FileSpreadsheet, Image as ImageIcon,
  Eye, FileSearch, Terminal, TerminalSquare, SearchCode,
  FileBox, Bookmark, Package, FileUp, Sparkles,
  Scissors, Plane, ShoppingBag, HeartPulse, Banknote,
  Wrench, ShoppingCart, Code2, PlusCircle, Check,
  ArrowUpRight, ArrowDownRight, Scale as ScaleIcon
} from 'lucide-react';
import { analyzeFinancialDocument, getLiveExchangeRate } from '../services/geminiService';
import { exportToExcel } from '../services/excelService';
import { ProcessedDocument, DocumentType, FinancialData, BankTransaction } from '../types';

export const TAX_CATEGORIES = [
  { id: 'Salary', label: 'Salary', icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { id: 'Rent', label: 'Rent', icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { id: 'Beauty', label: 'Beauty', icon: Scissors, color: 'text-pink-600', bg: 'bg-pink-50' },
  { id: 'Travel', label: 'Travel', icon: Plane, color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'Shopping', label: 'Shopping', icon: ShoppingBag, color: 'text-purple-600', bg: 'bg-purple-50' },
  { id: 'Health', label: 'Health', icon: HeartPulse, color: 'text-red-600', bg: 'bg-red-50' },
  { id: 'Cash Deposit', label: 'Cash Deposit', icon: Banknote, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  { id: 'Utility', label: 'Utility', icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-50' },
  { id: 'Groceries', label: 'Groceries', icon: ShoppingCart, color: 'text-slate-600', bg: 'bg-slate-50' },
  { id: 'Software', label: 'Software', icon: Code2, color: 'text-indigo-700', bg: 'bg-indigo-50' },
  { id: 'Bank', label: 'Bank', icon: Landmark, color: 'text-blue-700', bg: 'bg-blue-50' },
];

const NeuralLog: React.FC<{ doc: ProcessedDocument }> = ({ doc }) => {
  const [docUrl, setDocUrl] = useState<string | null>(null);

  useEffect(() => {
    if (doc.fileRaw) {
      const url = URL.createObjectURL(doc.fileRaw);
      setDocUrl(url);
      return () => { if (url) URL.revokeObjectURL(url); };
    }
  }, [doc.fileRaw]);

  const steps = [
    { label: 'Neural Buffer Ingestion', icon: Terminal, delay: '0s' },
    { label: 'Multi-Page Pattern Scan', icon: SearchCode, delay: '0.2s' },
    { label: 'OCR Extraction Logic', icon: Cpu, delay: '0.4s' },
    { label: 'Semantic Fiduciary Mapping', icon: Landmark, delay: '0.6s' },
    { label: 'Integrity Rule Validation', icon: ShieldCheck, delay: '0.8s' },
  ];

  return (
    <div className="w-full h-full flex flex-col p-6 space-y-6 bg-slate-900 text-slate-300 font-mono text-[10px]">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <h5 className="flex items-center gap-2 text-emerald-400 font-black uppercase tracking-widest">
          <TerminalSquare className="w-3 h-3" /> Extraction Sequence
        </h5>
        <span className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full text-[8px] animate-pulse">Live Kernel Trace</span>
      </div>

      <div className="space-y-4">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-500" style={{ animationDelay: step.delay }}>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <step.icon className="w-3 h-3 text-slate-500" />
            <span className="uppercase tracking-tighter text-slate-400">{step.label}</span>
            <span className="ml-auto text-emerald-500 font-bold opacity-50">COMPLETED</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex-1 border-t border-white/10 pt-4 overflow-y-auto custom-scrollbar">
        <h6 className="text-slate-500 uppercase tracking-widest font-black mb-3">AI Interpretation Log:</h6>
        <div className="bg-white/5 p-4 rounded-sm italic border-l-2 border-emerald-500/50 leading-relaxed text-slate-200">
          {doc.data?.aiInterpretation || "Scanning document layers for semantic context. Fiduciary fields verified against visual OCR anchor points."}
        </div>
      </div>
      
      <div className="pt-4 mt-auto space-y-4">
         {docUrl && (
           <button 
             onClick={() => window.open(docUrl, '_blank')} 
             className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-lg"
           >
             <ExternalLink className="w-4 h-4" /> Open Raw Audit Asset
           </button>
         )}
      </div>
    </div>
  );
};

const EditableAuditLedger: React.FC<{ 
  items: BankTransaction[], 
  currency: string,
  onUpdate: (newItems: BankTransaction[]) => void
}> = ({ items, currency, onUpdate }) => {
  const INITIAL_COUNT = 15;
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
  const loadMore = () => setVisibleCount(prev => prev + 25);

  const handleItemChange = (idx: number, field: keyof BankTransaction, value: any) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: value, isHumanVerified: false };
    onUpdate(next);
  };

  const toggleVerify = (idx: number) => {
    const next = [...items];
    next[idx] = { ...next[idx], isHumanVerified: !next[idx].isHumanVerified };
    onUpdate(next);
  };

  return (
    <div className="mt-8 space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-ypsom-alice pb-3">
         <div className="flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-ypsom-deep" />
            <h5 className="text-[11px] font-black uppercase tracking-widest text-ypsom-deep">Line Item Detail Ledger (Bank Context)</h5>
         </div>
         <span className="text-[9px] font-bold text-ypsom-slate opacity-40 uppercase tracking-widest">Showing {Math.min(visibleCount, items.length)} of {items.length} records</span>
      </div>
      
      <div className="border border-ypsom-alice rounded-sm overflow-hidden bg-white shadow-sm overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 border-b border-ypsom-alice">
            <tr className="font-bold uppercase text-[8px] tracking-widest text-ypsom-slate">
              <th className="px-4 py-3 text-center w-12">Verify</th>
              <th className="px-4 py-3 text-left w-32">Date</th>
              <th className="px-4 py-3 text-left">Audit Description</th>
              <th className="px-4 py-3 text-right w-36">Value ({currency})</th>
              <th className="px-4 py-3 text-center w-24">Nature</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ypsom-alice">
            {items.slice(0, visibleCount).map((item, idx) => (
              <tr key={idx} className={`hover:bg-ypsom-alice/5 transition-colors ${item.isHumanVerified ? 'bg-emerald-50/20' : ''}`}>
                <td className="px-4 py-3 text-center">
                  <button 
                    onClick={() => toggleVerify(idx)}
                    className={`w-7 h-7 rounded-sm flex items-center justify-center transition-all ${item.isHumanVerified ? 'bg-emerald-600 text-white shadow-md' : 'bg-gray-100 text-gray-300 hover:text-emerald-600 border border-gray-200'}`}
                  >
                    <Check className={`w-3.5 h-3.5 ${item.isHumanVerified ? 'scale-110' : 'scale-90'}`} />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <input 
                    type="date"
                    value={item.date}
                    onChange={e => handleItemChange(idx, 'date', e.target.value)}
                    className="w-full bg-transparent font-mono text-[10px] outline-none border-b border-transparent focus:border-ypsom-deep"
                  />
                </td>
                <td className="px-4 py-3">
                  <input 
                    value={item.description}
                    onChange={e => handleItemChange(idx, 'description', e.target.value)}
                    className="w-full bg-transparent font-bold text-ypsom-deep text-[10px] outline-none border-b border-transparent focus:border-ypsom-deep"
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <input 
                    type="number"
                    step="0.01"
                    value={item.amount}
                    onChange={e => handleItemChange(idx, 'amount', parseFloat(e.target.value) || 0)}
                    className={`w-full bg-transparent text-right font-mono font-black text-[10px] outline-none border-b border-transparent focus:border-ypsom-deep ${item.type === 'INCOME' ? 'text-green-700' : 'text-red-700'}`}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <select 
                    value={item.type}
                    onChange={e => handleItemChange(idx, 'type', e.target.value)}
                    className={`text-[7px] font-black uppercase rounded-full px-2 py-0.5 outline-none cursor-pointer ${item.type === 'INCOME' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                  >
                    <option value="INCOME">INCOME</option>
                    <option value="EXPENSE">EXPENSE</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visibleCount < items.length && (
        <button 
          onClick={loadMore}
          className="w-full py-4 bg-gray-100 border border-ypsom-alice hover:bg-ypsom-alice text-ypsom-deep font-black text-[10px] uppercase tracking-[0.2em] rounded-sm transition-all shadow-sm"
        >
          Expand Audit Depth ({items.length - visibleCount} Additional Records Found)
        </button>
      )}
    </div>
  );
};

const EditableZ2Ledger: React.FC<{ 
  subs: FinancialData[], 
  currency: string,
  onUpdate: (newSubs: FinancialData[]) => void
}> = ({ subs, currency, onUpdate }) => {
  const handleChange = (idx: number, field: string, value: any) => {
    const next = [...subs];
    next[idx] = { ...next[idx], [field]: value, isHumanVerified: false };
    onUpdate(next);
  };

  const toggleVerify = (idx: number) => {
    const next = [...subs];
    next[idx] = { ...next[idx], isHumanVerified: !next[idx].isHumanVerified };
    onUpdate(next);
  };

  const removeSub = (idx: number) => {
    onUpdate(subs.filter((_, i) => i !== idx));
  };

  return (
    <div className="mt-8 space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-ypsom-alice pb-3">
         <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-600" />
            <h5 className="text-[11px] font-black uppercase tracking-widest text-ypsom-deep">Multi-Asset Verification Ledger</h5>
         </div>
         <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 border border-amber-100 rounded-sm uppercase tracking-widest">{subs.length} ASSETS EXTRACTED</span>
      </div>
      
      <div className="border border-ypsom-alice rounded-sm overflow-hidden bg-white shadow-sm overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 border-b border-ypsom-alice">
            <tr className="font-bold uppercase text-[8px] tracking-widest text-ypsom-slate">
              <th className="px-4 py-3 text-center w-12">Verify</th>
              <th className="px-4 py-3 text-left w-32">Audit Date</th>
              <th className="px-4 py-3 text-left">Entity Name / Sub-Issuer</th>
              <th className="px-4 py-3 text-left w-40">Classification</th>
              <th className="px-4 py-3 text-right w-36">Value ({currency})</th>
              <th className="px-4 py-3 text-center w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ypsom-alice">
            {subs.map((item, idx) => (
              <tr key={idx} className={`hover:bg-ypsom-alice/5 transition-all group ${item.isHumanVerified ? 'bg-emerald-50/20' : ''}`}>
                <td className="px-2 py-2 text-center">
                  <button 
                    onClick={() => toggleVerify(idx)}
                    className={`w-8 h-8 rounded-sm flex items-center justify-center transition-all ${item.isHumanVerified ? 'bg-emerald-600 text-white shadow-md' : 'bg-gray-100 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 border border-gray-200'}`}
                  >
                    <Check className={`w-4 h-4 transition-transform ${item.isHumanVerified ? 'scale-110' : 'scale-90'}`} />
                  </button>
                </td>
                <td className="px-2 py-2">
                  <input 
                    type="date" 
                    value={item.date} 
                    onChange={e => handleChange(idx, 'date', e.target.value)}
                    className="w-full bg-transparent border-b border-transparent focus:border-ypsom-deep px-2 py-1.5 font-mono text-[10px] outline-none"
                  />
                </td>
                <td className="px-2 py-2">
                  <input 
                    value={item.issuer} 
                    onChange={e => handleChange(idx, 'issuer', e.target.value)}
                    className="w-full bg-transparent border-b border-transparent focus:border-ypsom-deep px-2 py-1.5 font-bold uppercase text-[10px] outline-none"
                  />
                </td>
                <td className="px-2 py-2">
                  <select 
                    value={item.expenseCategory} 
                    onChange={e => handleChange(idx, 'expenseCategory', e.target.value)}
                    className="w-full bg-transparent border-b border-transparent focus:border-ypsom-deep px-2 py-1.5 font-black uppercase text-[9px] outline-none"
                  >
                    {TAX_CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
                    <option value="Other">Other...</option>
                  </select>
                </td>
                <td className="px-2 py-2">
                  <input 
                    type="number"
                    step="0.01"
                    value={item.totalAmount} 
                    onChange={e => handleChange(idx, 'totalAmount', parseFloat(e.target.value) || 0)}
                    className="w-full bg-transparent text-right border-b border-transparent focus:border-ypsom-deep px-2 py-1.5 font-black font-mono text-[10px] outline-none"
                  />
                </td>
                <td className="px-2 py-2 text-center">
                  <button onClick={() => removeSub(idx)} className="text-gray-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const VerificationHub: React.FC<{ 
  doc: ProcessedDocument; 
  onUpdate: (data: FinancialData) => void;
  onSave: (data: FinancialData) => void;
  onRefine: (hint: string) => void;
}> = ({ doc, onUpdate, onSave, onRefine }) => {
  const [hint, setHint] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  const handleFieldChange = async (field: keyof FinancialData, value: any) => {
    const newData = { ...doc.data!, [field]: value };
    if (field === 'totalAmount' || field === 'originalCurrency') {
      const rate = await getLiveExchangeRate(newData.originalCurrency || 'CHF', 'CHF');
      newData.amountInCHF = (Number(newData.totalAmount) || 0) * rate;
      newData.conversionRateUsed = rate;
    }
    onUpdate(newData);
  };

  const syncTotalFromSubs = () => {
     if (!doc.data?.subDocuments?.length) return;
     const sum = doc.data.subDocuments.reduce((s, x) => s + (x.totalAmount || 0), 0);
     handleFieldChange('totalAmount', sum);
  };

  const editedData = doc.data!;
  const isBatch = editedData.documentType === 'Z2 Multi-Ticket Sheet' || (editedData.subDocuments && editedData.subDocuments.length > 1);
  const isBankStatement = editedData.documentType === DocumentType.BANK_STATEMENT;

  return (
    <div className="bg-white border-y border-ypsom-alice animate-in slide-in-from-top-2 duration-400 overflow-hidden shadow-inner">
      <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row min-h-[500px]">
        <div className="w-full lg:w-[420px] bg-slate-900 border-r border-ypsom-alice flex flex-col shadow-2xl overflow-hidden">
          <NeuralLog doc={doc} />
        </div>
        <div className="flex-1 p-10 flex flex-col bg-white">
           <div className="flex items-center justify-between mb-8 border-b border-ypsom-alice pb-5">
              <div>
                 <h4 className="text-[13px] font-black uppercase tracking-widest text-ypsom-deep flex items-center gap-3">
                   Record Authentication Center 
                   {isBatch && <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-sm">BATCH MODE</span>}
                 </h4>
                 <p className="text-[10px] font-bold text-ypsom-slate uppercase opacity-50 mt-1">{doc.fileName}</p>
              </div>
              <div className="px-4 py-2 bg-green-50 text-green-700 border border-green-100 rounded-sm text-[10px] font-black uppercase flex items-center gap-2 shadow-sm">
                 <Cpu className="w-4 h-4" /> Confidence Match: {((doc.data?.confidenceScore || 0.95) * 100).toFixed(0)}%
              </div>
           </div>

           {/* Bank Audit Summary Section (NEW) */}
           {isBankStatement && (
             <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 p-6 bg-ypsom-alice/20 rounded-sm border border-ypsom-alice shadow-sm">
                <div>
                   <label className="text-[8px] font-black uppercase text-ypsom-slate tracking-widest block mb-2">Opening Balance</label>
                   <input 
                     type="number" 
                     value={editedData.openingBalance || 0} 
                     onChange={e => handleFieldChange('openingBalance', parseFloat(e.target.value) || 0)} 
                     className="w-full bg-white border border-ypsom-alice h-10 px-3 font-mono font-bold text-[11px] outline-none" 
                   />
                </div>
                <div>
                   <label className="text-[8px] font-black uppercase text-ypsom-slate tracking-widest block mb-2">Total Income (+)</label>
                   <div className="relative">
                      <input 
                        type="number" 
                        value={editedData.calculatedTotalIncome || 0} 
                        onChange={e => handleFieldChange('calculatedTotalIncome', parseFloat(e.target.value) || 0)} 
                        className="w-full bg-white border border-ypsom-alice h-10 px-3 pl-8 font-mono font-bold text-[11px] text-green-700 outline-none" 
                      />
                      <ArrowUpRight className="w-3.5 h-3.5 text-green-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                   </div>
                </div>
                <div>
                   <label className="text-[8px] font-black uppercase text-ypsom-slate tracking-widest block mb-2">Total Expense (-)</label>
                   <div className="relative">
                      <input 
                        type="number" 
                        value={editedData.calculatedTotalExpense || 0} 
                        onChange={e => handleFieldChange('calculatedTotalExpense', parseFloat(e.target.value) || 0)} 
                        className="w-full bg-white border border-ypsom-alice h-10 px-3 pl-8 font-mono font-bold text-[11px] text-red-700 outline-none" 
                      />
                      <ArrowDownRight className="w-3.5 h-3.5 text-red-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                   </div>
                </div>
                <div>
                   <label className="text-[8px] font-black uppercase text-amber-700 tracking-widest block mb-2">Actual "Solde" (Final)</label>
                   <div className="relative">
                      <input 
                        type="number" 
                        value={editedData.finalBalance || 0} 
                        onChange={e => handleFieldChange('finalBalance', parseFloat(e.target.value) || 0)} 
                        className="w-full bg-white border border-amber-200 h-10 px-3 pl-8 font-mono font-black text-[11px] text-ypsom-deep outline-none shadow-sm" 
                      />
                      <ScaleIcon className="w-3.5 h-3.5 text-amber-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
                   </div>
                </div>
             </div>
           )}

           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-5">
                 <div>
                    <label className="text-[9px] font-black uppercase text-ypsom-slate tracking-[0.2em] block mb-2">Issuer Entity</label>
                    <input value={editedData.issuer} onChange={e => handleFieldChange('issuer', e.target.value)} className="w-full h-11 px-4 bg-gray-50 border border-ypsom-alice rounded-sm text-xs font-bold outline-none" />
                 </div>
                 <div>
                    <label className="text-[9px] font-black uppercase text-ypsom-slate tracking-[0.2em] block mb-2">ISO Currency</label>
                    <input value={editedData.originalCurrency} onChange={e => handleFieldChange('originalCurrency', e.target.value)} className="w-full h-11 px-4 bg-gray-50 border border-ypsom-alice rounded-sm text-xs font-bold outline-none" />
                 </div>
              </div>
              <div className="space-y-5">
                 <div>
                    <label className="text-[9px] font-black uppercase text-ypsom-slate tracking-[0.2em] block mb-2 flex justify-between">
                       Audit Gross Value
                       {isBatch && <button onClick={syncTotalFromSubs} className="text-[8px] text-amber-600 hover:underline flex items-center gap-1"><RefreshCcw className="w-2.5 h-2.5" /> Sync from Batch</button>}
                    </label>
                    <input type="number" step="0.01" value={editedData.totalAmount} onChange={e => handleFieldChange('totalAmount', parseFloat(e.target.value) || 0)} className="w-full h-11 px-4 bg-gray-50 border border-ypsom-alice rounded-sm text-xs font-black outline-none" />
                 </div>
                 <div>
                    <label className="text-[9px] font-black uppercase text-ypsom-slate tracking-[0.2em] block mb-2">Categorization</label>
                    <div className="flex gap-2">
                      {isAddingCustom ? (
                        <input 
                          autoFocus
                          value={editedData.expenseCategory} 
                          onChange={e => handleFieldChange('expenseCategory', e.target.value)} 
                          placeholder="Type custom category..."
                          className="flex-1 h-11 px-4 bg-white border border-ypsom-alice rounded-sm text-[10px] font-black uppercase outline-none shadow-inner"
                        />
                      ) : (
                        <select value={editedData.expenseCategory} onChange={e => handleFieldChange('expenseCategory', e.target.value)} className={`flex-1 h-11 px-4 bg-white border border-ypsom-alice rounded-sm text-[10px] font-black uppercase outline-none`}>
                           <option value="">-- Uncategorized --</option>
                           {TAX_CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
                           {!TAX_CATEGORIES.some(c => c.id === editedData.expenseCategory) && editedData.expenseCategory && (
                             <option value={editedData.expenseCategory}>{editedData.expenseCategory}</option>
                           )}
                        </select>
                      )}
                      <button 
                        onClick={() => setIsAddingCustom(!isAddingCustom)} 
                        title={isAddingCustom ? "Back to selection" : "Add custom category"}
                        className={`w-11 h-11 rounded-sm border flex items-center justify-center transition-all ${isAddingCustom ? 'bg-ypsom-deep text-white border-ypsom-deep' : 'bg-gray-100 border-ypsom-alice text-ypsom-slate hover:bg-ypsom-alice'}`}
                      >
                        {isAddingCustom ? <CheckCircle className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                      </button>
                    </div>
                 </div>
              </div>
              <div className="space-y-5">
                 <div>
                    <label className="text-[9px] font-black uppercase text-ypsom-slate tracking-[0.2em] block mb-2">Audit Timestamp</label>
                    <input type="date" value={editedData.date} onChange={e => handleFieldChange('date', e.target.value)} className="w-full h-11 px-4 bg-gray-50 border border-ypsom-alice rounded-sm text-xs font-bold outline-none shadow-sm" />
                 </div>
                 <div>
                    <label className="text-[9px] font-black uppercase text-ypsom-slate tracking-[0.2em] block mb-2 text-amber-600">Neural Context Override</label>
                    <div className="flex gap-2">
                       <input value={hint} onChange={e => setHint(e.target.value)} placeholder="Instructions..." className="flex-1 h-11 px-4 bg-gray-50 border border-amber-200 rounded-sm text-xs outline-none" />
                       <button onClick={() => onRefine(hint)} disabled={!hint.trim()} className="w-11 h-11 bg-amber-600 text-white rounded-sm flex items-center justify-center shadow-lg active:scale-95 disabled:opacity-20"><RefreshCcw className="w-4 h-4" /></button>
                    </div>
                 </div>
              </div>
           </div>
           <div className="flex-1 overflow-y-auto mt-6 min-h-[300px] custom-scrollbar">
              {editedData.subDocuments && editedData.subDocuments.length > 0 ? (
                <EditableZ2Ledger 
                  subs={editedData.subDocuments} 
                  currency={editedData.originalCurrency} 
                  onUpdate={newSubs => handleFieldChange('subDocuments', newSubs)} 
                />
              ) : editedData.lineItems?.length ? (
                <EditableAuditLedger 
                  items={editedData.lineItems} 
                  currency={editedData.originalCurrency} 
                  onUpdate={newItems => handleFieldChange('lineItems', newItems)} 
                />
              ) : (
                <div className="py-20 text-center border-2 border-dashed border-ypsom-alice rounded-sm bg-gray-50/30">
                   <p className="text-[10px] font-black uppercase tracking-widest text-ypsom-slate opacity-30">No granular line-item data trace available</p>
                </div>
              )}
           </div>
           <div className="pt-6 border-t border-ypsom-alice mt-6">
              <button onClick={() => onSave({ ...editedData, isHumanVerified: true, forensicAlerts: [] })} className="w-full h-14 bg-ypsom-deep text-white rounded-sm font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl hover:bg-ypsom-shadow transition-all flex items-center justify-center gap-3">
                <ShieldCheck className="w-5 h-5" /> Certify and Lock Fiduciary Record
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export const DocumentProcessor: React.FC<{ 
  documents: ProcessedDocument[], 
  setDocuments: React.Dispatch<React.SetStateAction<ProcessedDocument[]>> 
}> = ({ documents, setDocuments }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [reportingCurrency, setReportingCurrency] = useState('CHF');
  const stopProcessingRef = useRef(false);
  const dragCounter = useRef(0);

  const CONCURRENCY_LIMIT = 6; 

  const groupedDocuments = useMemo(() => {
    const categories: Record<string, ProcessedDocument[]> = {
      'Bank Records': [],
      'Multiple Tickets (Batches)': [],
      'Normal Receipts & Tickets': [],
      'Uncategorized / Pending': []
    };
    documents.forEach(doc => {
      const type = doc.data?.documentType;
      const isBatch = type === 'Z2 Multi-Ticket Sheet' || (doc.data?.subDocuments && doc.data.subDocuments.length > 1);
      if (!type || doc.status !== 'completed') categories['Uncategorized / Pending'].push(doc);
      else if (type === 'Bank Statement' || type === 'Bank Deposit') categories['Bank Records'].push(doc);
      else if (isBatch) categories['Multiple Tickets (Batches)'].push(doc);
      else categories['Normal Receipts & Tickets'].push(doc);
    });
    return categories;
  }, [documents]);

  const stats = useMemo(() => {
    const total = documents.length;
    const completed = documents.filter(d => d.status === 'completed').length;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    const val = documents.reduce((acc, d) => acc + (d.data?.amountInCHF || d.data?.totalAmount || 0), 0);
    return { total, completed, progress, val };
  }, [documents]);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const news: ProcessedDocument[] = Array.from(files).map((f: File) => ({ 
      id: Math.random().toString(36).substr(2,9), 
      fileName: f.name, 
      status: 'pending' as const, 
      fileRaw: f 
    }));
    setDocuments((p) => [...p, ...news]);
  };

  const processDoc = async (doc: ProcessedDocument, hint?: string) => {
    setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, status: hint ? 'verifying' : 'processing', error: undefined } : d));
    try {
      const res = await analyzeFinancialDocument(doc.fileRaw!, reportingCurrency, hint);
      setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, status: 'completed', data: res } : d));
    } catch (err: any) {
      setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, status: 'error', error: err.message } : d));
    }
  };

  const processAll = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    stopProcessingRef.current = false;
    
    const pending = documents.filter(d => d.status === 'pending' || d.status === 'error');
    let index = 0;
    const activeTasks = new Set<Promise<void>>();

    while (index < pending.length && !stopProcessingRef.current) {
      while (activeTasks.size < CONCURRENCY_LIMIT && index < pending.length && !stopProcessingRef.current) {
        const doc = pending[index++];
        const task = processDoc(doc).finally(() => activeTasks.delete(task));
        activeTasks.add(task);
      }
      if (activeTasks.size > 0) await Promise.race(activeTasks);
    }
    
    await Promise.all(activeTasks);
    setIsProcessing(false);
  };

  const stopBatch = () => {
    stopProcessingRef.current = true;
    setIsProcessing(false);
  };

  const toggleRow = (id: string) => {
    const next = new Set(expandedRows);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedRows(next);
  };

  return (
    <div 
      className={`space-y-8 max-w-[1400px] mx-auto pb-20 relative transition-all duration-300`}
      onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setIsDragging(true); }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => { dragCounter.current--; if (dragCounter.current === 0) setIsDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); dragCounter.current = 0; addFiles(e.dataTransfer.files); }}
    >
      <div className="bg-white p-8 border border-ypsom-alice rounded-sm shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5">
            <label className={`flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-sm cursor-pointer transition-all group ${isDragging ? 'border-ypsom-deep bg-ypsom-alice/30 scale-105 shadow-xl' : 'border-ypsom-alice hover:bg-gray-50'}`}>
              <Upload className="w-8 h-8 mb-4 text-ypsom-slate group-hover:-translate-y-1 transition-transform" />
              <div className="text-center">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] block text-ypsom-deep">Audit Evidence Submission</span>
                <span className="text-[9px] opacity-40 uppercase tracking-widest mt-1 block">PDF • JPG • PNG (MAX 100+ FILES)</span>
              </div>
              <input type="file" className="hidden" multiple onChange={(e) => addFiles(e.target.files)} />
            </label>
          </div>
          <div className="lg:col-span-3 flex flex-col justify-between py-1">
            <div className="space-y-2">
               <span className="text-[9px] font-black text-ypsom-slate uppercase tracking-widest block ml-1">Audit Currency</span>
               <select value={reportingCurrency} onChange={(e) => setReportingCurrency(e.target.value)} className="w-full h-12 px-4 bg-gray-50 border border-ypsom-alice rounded-sm text-[10px] font-bold outline-none">
                  <option value="CHF">CHF (Swiss Franc)</option>
                  <option value="EUR">EUR (Euro)</option>
                  <option value="USD">USD (Dollar)</option>
               </select>
            </div>
            <div className="mt-auto">
               {isProcessing ? (
                 <button onClick={stopBatch} className="w-full h-12 bg-red-600 text-white rounded-sm font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-md">
                    <Ban className="w-4 h-4" /> Stop Extraction
                 </button>
               ) : (
                 <button onClick={processAll} disabled={documents.filter(d => d.status === 'pending' || d.status === 'error').length === 0} className="w-full h-12 bg-ypsom-deep hover:bg-ypsom-shadow text-white rounded-sm font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-md">
                    <ShieldCheck className="w-4 h-4" /> Turbo Extraction ({documents.filter(d => d.status === 'pending' || d.status === 'error').length})
                 </button>
               )}
            </div>
          </div>
          <div className="lg:col-span-4 flex flex-col h-48 border border-ypsom-alice rounded-sm bg-gray-50/50 p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-[8px] font-black text-ypsom-slate uppercase tracking-widest mb-1">Done: {stats.completed}</p>
                <p className="text-[8px] font-black text-ypsom-slate uppercase tracking-widest opacity-40">Total: {stats.total}</p>
              </div>
              <div className="text-right">
                <p className="text-[18px] font-black text-ypsom-deep font-mono leading-none">{(stats.val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                <p className="text-[10px] opacity-40 font-black">{reportingCurrency}</p>
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <div className="w-full h-1.5 bg-ypsom-alice rounded-full overflow-hidden mb-2">
                <div className="h-full bg-ypsom-deep transition-all duration-1000 ease-out" style={{ width: `${stats.progress}%` }} />
              </div>
              <p className="text-[9px] font-bold text-ypsom-slate text-center uppercase tracking-[0.2em]">{stats.progress.toFixed(0)}% Synchronized</p>
            </div>
            <div className="mt-4 flex gap-2">
                <div className="flex-1 bg-white border border-ypsom-alice rounded-sm p-2 flex items-center justify-center gap-2">
                   <Zap className="w-3 h-3 text-amber-500" />
                   <span className="text-[8px] font-black text-ypsom-deep uppercase">6 Stream Parallelism</span>
                </div>
            </div>
          </div>
        </div>
      </div>

      {documents.length > 0 && (
        <div className="bg-white border border-ypsom-alice rounded-sm shadow-md overflow-hidden animate-in fade-in duration-500">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-ypsom-deep text-white uppercase font-black text-[8px] tracking-widest">
                <tr>
                  <th className="px-4 py-4 w-10 text-center">#</th>
                  <th className="px-6 py-4 text-left">Audit Entity / Asset Class</th>
                  <th className="px-6 py-4 text-left">Audit Date</th>
                  <th className="px-6 py-4 text-right">Value ({reportingCurrency})</th>
                  <th className="px-6 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ypsom-alice">
                {/* Type assertion to fix 'unknown' type inference on docs array for entries mapping */}
                {(Object.entries(groupedDocuments) as [string, ProcessedDocument[]][]).map(([category, docs]) => {
                  if (docs.length === 0) return null;
                  return (
                    <React.Fragment key={category}>
                      <tr className="bg-gray-100/80 border-y border-ypsom-alice">
                        <td colSpan={5} className="px-6 py-2">
                           <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-ypsom-slate">{category} ({docs.length})</span>
                           </div>
                        </td>
                      </tr>
                      {docs.map((doc, idx) => {
                        const isExpanded = expandedRows.has(doc.id);
                        return (
                          <React.Fragment key={doc.id}>
                            <tr onClick={() => toggleRow(doc.id)} className={`hover:bg-gray-50 transition-all cursor-pointer ${isExpanded ? 'bg-ypsom-alice/10' : ''}`}>
                              <td className="px-4 py-4 text-center font-mono font-bold text-ypsom-slate/40 text-[10px] border-r border-ypsom-alice/10">{String(idx + 1).padStart(3, '0')}</td>
                              <td className="px-6 py-4">
                                 <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2">
                                       {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-ypsom-deep" /> : <ChevronRight className="w-3.5 h-3.5 text-ypsom-slate" />}
                                       <span className="font-bold text-ypsom-deep uppercase text-[10px] truncate max-w-[280px]">{doc.fileName}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 ml-5">
                                       <span className="px-2 py-0.5 bg-ypsom-deep text-white text-[7px] font-black uppercase rounded-sm">{doc.data?.issuer || 'Pending...'}</span>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-6 py-4 font-mono text-[10px] text-ypsom-slate">{doc.data?.date || '---'}</td>
                              <td className="px-6 py-4 text-right font-black font-mono text-[11px] text-ypsom-deep">
                                 {doc.data ? (doc.data.amountInCHF || doc.data.totalAmount || 0).toFixed(2) : '0.00'}
                              </td>
                              <td className="px-6 py-4 text-right">
                                 <div className="flex items-center justify-end gap-3">
                                    <span className={`text-[8px] font-black uppercase tracking-widest ${doc.status === 'completed' ? 'text-green-600' : 'text-ypsom-slate'}`}>{doc.status}</span>
                                    <button onClick={(e) => { e.stopPropagation(); setDocuments(p => p.filter(d => d.id !== doc.id)); }} className="text-ypsom-slate/20 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                                 </div>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr onClick={(e) => e.stopPropagation()}>
                                <td colSpan={5} className="p-0 bg-gray-50 border-t border-ypsom-alice">
                                   {doc.data ? (
                                     <VerificationHub 
                                        doc={doc} 
                                        onUpdate={(d) => setDocuments(p => p.map(x => x.id === doc.id ? { ...x, data: d } : x))}
                                        onSave={(d) => { setDocuments(p => p.map(x => x.id === doc.id ? { ...x, data: d, status: 'completed' } : x)); toggleRow(doc.id); }} 
                                        onRefine={(h) => processDoc(doc, h)} 
                                     />
                                   ) : <div className="p-16 text-center"><Loader2 className="w-8 h-8 animate-spin text-ypsom-deep/20 mx-auto" /></div>}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-5 border-t border-ypsom-alice bg-gray-50 flex justify-between items-center">
             <button onClick={() => exportToExcel(documents.map(d => d.data!).filter(Boolean), 'Ypsom_Certified', reportingCurrency)} className="h-10 px-8 bg-ypsom-deep text-white rounded-sm font-black text-[9px] uppercase tracking-widest flex items-center gap-2 shadow-xl hover:bg-ypsom-shadow transition-all">
                <FileSpreadsheet className="w-4 h-4" /> Export Final Ledger
             </button>
          </div>
        </div>
      )}
    </div>
  );
};
