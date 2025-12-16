import React, { useState } from 'react';
import { Sparkles, Image as ImageIcon, ArrowRight, Download, Loader2 } from 'lucide-react';
import { editImageWithGemini } from '../services/geminiService';

export const NanoBananaEditor: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setGeneratedImage(null);
      setError(null);
    }
  };

  const handleGenerate = async () => {
    if (!selectedImage || !prompt) return;

    setIsGenerating(true);
    setError(null);
    try {
      const result = await editImageWithGemini(selectedImage, prompt);
      setGeneratedImage(result);
    } catch (err) {
      setError("Failed to generate image. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
      {/* Input Section */}
      <div className="flex flex-col space-y-6">
        <div className="bg-white p-6 rounded-sm shadow-sm border border-ypsom-alice h-full flex flex-col">
          <h2 className="text-xl font-bold text-ypsom-deep mb-6 flex items-center border-b border-ypsom-alice pb-3">
            <ImageIcon className="w-5 h-5 mr-2 text-ypsom-slate" /> Source Image
          </h2>
          
          <div className="flex-grow flex flex-col justify-center">
            {!previewUrl ? (
              <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-ypsom-alice rounded-sm cursor-pointer hover:bg-ypsom-alice/20 hover:border-ypsom-slate transition-all">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <ImageIcon className="w-10 h-10 mb-3 text-ypsom-slate/50" />
                  <p className="mb-2 text-sm text-ypsom-shadow">Upload an image to edit</p>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleImageSelect} />
              </label>
            ) : (
              <div className="relative rounded-sm overflow-hidden border border-ypsom-alice bg-gray-50">
                <img src={previewUrl} alt="Original" className="w-full h-64 object-contain" />
                <button 
                  onClick={() => { setSelectedImage(null); setPreviewUrl(null); }}
                  className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full text-ypsom-shadow hover:text-red-600 shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
            )}
          </div>

          <div className="mt-8">
            <label className="block text-sm font-semibold text-ypsom-deep mb-2">
              Modification Prompt
            </label>
            <div className="relative">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the desired changes in detail..."
                className="w-full pl-4 pr-12 py-3 border border-ypsom-alice rounded-sm focus:ring-1 focus:ring-ypsom-deep focus:border-ypsom-deep transition-all shadow-sm text-ypsom-shadow placeholder-ypsom-slate/50"
              />
              <Sparkles className="absolute right-3 top-3.5 w-5 h-5 text-ypsom-slate" />
            </div>
            
            <button
              onClick={handleGenerate}
              disabled={!selectedImage || !prompt || isGenerating}
              className={`mt-4 w-full flex items-center justify-center py-3 rounded-sm font-semibold text-white transition-all shadow-sm ${
                !selectedImage || !prompt || isGenerating
                  ? 'bg-ypsom-slate cursor-not-allowed opacity-70'
                  : 'bg-ypsom-deep hover:bg-ypsom-shadow hover:shadow-md'
              }`}
            >
              {isGenerating ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing...</>
              ) : (
                <><Sparkles className="w-5 h-5 mr-2" /> Generate Edit</>
              )}
            </button>
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          </div>
        </div>
      </div>

      {/* Output Section */}
      <div className="flex flex-col">
        <div className="bg-white p-6 rounded-sm shadow-sm border border-ypsom-alice h-full flex flex-col">
          <h2 className="text-xl font-bold text-ypsom-deep mb-6 flex items-center border-b border-ypsom-alice pb-3">
            <Sparkles className="w-5 h-5 mr-2 text-ypsom-slate" /> Processed Result
          </h2>
          
          <div className="flex-grow flex items-center justify-center bg-gray-50 rounded-sm border border-ypsom-alice border-dashed min-h-[300px]">
            {generatedImage ? (
              <div className="relative w-full h-full flex flex-col">
                <img src={generatedImage} alt="Generated" className="w-full h-full object-contain rounded-t-sm" />
                <a 
                  href={generatedImage} 
                  download="ypsom-edited-asset.png"
                  className="flex items-center justify-center w-full py-3 bg-ypsom-deep text-white rounded-b-sm hover:bg-ypsom-shadow transition-colors font-medium"
                >
                  <Download className="w-4 h-4 mr-2" /> Download Asset
                </a>
              </div>
            ) : (
              <div className="text-center text-ypsom-slate/40">
                <div className="bg-ypsom-alice/30 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-ypsom-alice">
                  <ArrowRight className="w-8 h-8 text-ypsom-slate/40" />
                </div>
                <p>Output will appear here</p>
              </div>
            )}
          </div>
          
          <div className="mt-6 bg-ypsom-alice/20 p-4 rounded-sm border border-ypsom-alice">
             <h4 className="text-sm font-semibold text-ypsom-deep mb-1">Powered by Gemini 2.5 Flash</h4>
             <p className="text-xs text-ypsom-slate">
               Utilizes Nano Banana technology for high-fidelity image reconstruction and contextual editing suited for professional assets.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};