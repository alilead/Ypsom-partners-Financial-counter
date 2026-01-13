import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
// Fix: Added Zap to the imports from lucide-react to resolve the "Cannot find name 'Zap'" error.
import { Upload, Camera, Search, Loader2, FileSearch, Sparkles, X, Eye, AlertCircle, RefreshCw, Zap } from 'lucide-react';
import { fileToBase64 } from '../services/geminiService';

export const NanoBananaEditor: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('Analyze this financial document for any signs of tampering or handwritten notes. Extract the handwritten text specifically if found.');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setAnalysisResult(null);
    }
  };

  const runVisualAudit = async () => {
    if (!selectedImage || isAnalyzing) return;
    setIsAnalyzing(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const base64 = await fileToBase64(selectedImage);
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image', // Nano Banana
        contents: {
          parts: [
            { inlineData: { mimeType: selectedImage.type, data: base64 } },
            { text: customPrompt }
          ]
        }
      });

      setAnalysisResult(response.text || "No insights extracted from visual analysis.");
    } catch (err: any) {
      setAnalysisResult(`Visual Analysis Error: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="bg-white p-8 rounded-sm shadow-sm border border-ypsom-alice">
        <div className="flex items-center gap-4 mb-8">
           <div className="p-3 bg-ypsom-deep rounded-sm">
              <Eye className="w-6 h-6 text-white" />
           </div>
           <div>
              <h2 className="text-xl font-black text-ypsom-deep uppercase tracking-widest">Visual Audit Intelligence</h2>
              <p className="text-[11px] font-bold text-ypsom-slate uppercase tracking-widest opacity-60">LLM-Powered Vision Analysis (Nano Banana Engine)</p>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Image Selection & Preview */}
          <div className="space-y-6">
             {!previewUrl ? (
               <label className="flex flex-col items-center justify-center h-[400px] border-2 border-dashed border-ypsom-alice hover:bg-gray-50 rounded-sm cursor-pointer transition-all group">
                  <Camera className="w-12 h-12 text-ypsom-slate mb-4 group-hover:scale-110 transition-transform" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-ypsom-slate text-center">
                    Upload High-Resolution Evidence<br/>for Visual Forensic Analysis
                  </p>
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
               </label>
             ) : (
               <div className="relative h-[400px] bg-black/5 rounded-sm border border-ypsom-alice overflow-hidden group">
                  <img src={previewUrl} className="w-full h-full object-contain" alt="Evidence Preview" />
                  <button 
                    onClick={() => { setSelectedImage(null); setPreviewUrl(null); setAnalysisResult(null); }}
                    className="absolute top-4 right-4 p-2 bg-white/90 shadow-lg rounded-sm hover:text-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                     <p className="text-[9px] text-white font-black uppercase tracking-widest">{selectedImage?.name}</p>
                  </div>
               </div>
             )}
          </div>

          {/* Analysis Controls & Result */}
          <div className="flex flex-col h-full">
             <div className="mb-6">
                <label className="block text-[10px] font-black uppercase tracking-widest text-ypsom-slate mb-2">Analysis Objective</label>
                <textarea 
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="w-full h-32 bg-gray-50 border border-ypsom-alice rounded-sm p-4 text-xs font-medium text-ypsom-deep focus:outline-none focus:ring-1 focus:ring-ypsom-deep resize-none"
                  placeholder="Ask the AI Vision engine anything about the document..."
                />
             </div>

             <button 
               onClick={runVisualAudit}
               disabled={!selectedImage || isAnalyzing}
               className="w-full h-12 bg-ypsom-deep text-white rounded-sm font-black text-[11px] uppercase tracking-[0.2em] shadow-xl hover:bg-ypsom-shadow disabled:opacity-50 transition-all flex items-center justify-center gap-2 mb-6"
             >
               {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
               Run Visual Diagnostic
             </button>

             <div className="flex-1 bg-gray-50 border border-ypsom-alice rounded-sm p-6 overflow-y-auto min-h-[160px]">
                {!analysisResult && !isAnalyzing ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                    <FileSearch className="w-8 h-8 mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Analysis</p>
                  </div>
                ) : isAnalyzing ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                    <RefreshCw className="w-6 h-6 animate-spin text-ypsom-deep" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-ypsom-slate animate-pulse">Running Nano Banana Vision Engine...</p>
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 mb-4">
                       <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                       <span className="text-[9px] font-black uppercase tracking-widest text-ypsom-slate">Forensic Insights</span>
                    </div>
                    <p className="text-sm font-medium text-ypsom-deep leading-relaxed whitespace-pre-wrap">
                      {analysisResult}
                    </p>
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-5 rounded-sm border border-ypsom-alice shadow-sm flex items-start gap-4">
            <div className="p-2 bg-alice/30 rounded-sm">
               <AlertCircle className="w-4 h-4 text-ypsom-deep" />
            </div>
            <div>
               <p className="text-[9px] font-black uppercase text-ypsom-slate mb-1">Handwriting Detection</p>
               <p className="text-[11px] text-ypsom-deep/70">Extract handwritten notes, stamps, or specific reference codes that traditional OCR often misses.</p>
            </div>
         </div>
         <div className="bg-white p-5 rounded-sm border border-ypsom-alice shadow-sm flex items-start gap-4">
            <div className="p-2 bg-alice/30 rounded-sm">
               <Zap className="w-4 h-4 text-ypsom-deep" />
            </div>
            <div>
               <p className="text-[9px] font-black uppercase text-ypsom-slate mb-1">Anomaly Discovery</p>
               <p className="text-[11px] text-ypsom-deep/70">Visually identify logos, brand consistency, and potential formatting irregularities in audit evidence.</p>
            </div>
         </div>
         <div className="bg-white p-5 rounded-sm border border-ypsom-alice shadow-sm flex items-start gap-4">
            <div className="p-2 bg-alice/30 rounded-sm">
               <Search className="w-4 h-4 text-ypsom-deep" />
            </div>
            <div>
               <p className="text-[9px] font-black uppercase text-ypsom-slate mb-1">Visual Verification</p>
               <p className="text-[11px] text-ypsom-deep/70">Compare visual artifacts against known corporate identities to ensure document authenticity.</p>
            </div>
         </div>
      </div>
    </div>
  );
};