import React, { useState, useRef, useEffect } from 'react';
import { fileToBase64, downloadMedia } from '../utils';
import { geminiService, withRetry } from '../services/geminiService';

const ImageEnhancer: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeMode, setActiveMode] = useState<'auto' | 'remedy' | 'video' | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video'>('image');
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (loading) {
      setProgress(0);
      progressIntervalRef.current = window.setInterval(() => {
        setProgress(prev => {
          if (prev < 95) return prev + Math.random() * 5;
          return prev;
        });
      }, 500);
    } else {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [loading]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      const isVideo = selected.type.startsWith('video/');
      setFileType(isVideo ? 'video' : 'image');
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setResult(null);
    }
  };

  const handleRemove = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setPrompt('');
    setLoading(false);
    setProgress(0);
    setActiveMode(null);
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setLoading(false);
    setProgress(0);
    setActiveMode(null);
  };

  const handleRemedy = async (mode: 'auto' | 'remedy') => {
    if (!file) return;
    setLoading(true);
    setActiveMode(fileType === 'video' ? 'video' : mode);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    try {
      if (fileType === 'video') {
        const op = await geminiService.remedyVideo(file, prompt);
        const resultOp = await geminiService.pollOperation(op, signal);
        const downloadLink = resultOp.response?.generatedVideos?.[0]?.video?.uri;
        
        if (downloadLink) {
          const blob = await withRetry(async () => {
            const apiKey = process.env.API_KEY;
            const res = await fetch(`${downloadLink}&key=${apiKey}`, { signal });
            return await res.blob();
          });
          setResult(URL.createObjectURL(blob));
        }
      } else {
        const base64 = await fileToBase64(file);
        if (signal.aborted) return;
        const enhanced = await geminiService.enhanceImage(base64, mode, prompt);
        if (signal.aborted) return;
        setResult(enhanced);
      }
      setProgress(100);
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Process cancelled.");
      } else {
        alert(`Error: ${err.message || 'The studio engine encountered an issue.'}`);
      }
    } finally {
      setLoading(false);
      setActiveMode(null);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-12">
      <div className="lg:col-span-5 space-y-8">
        <div className="space-y-4">
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">Remedy Studio</h2>
          <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em]">AI Watermark & Logo Removal</p>
        </div>

        <div className="space-y-6 bg-white/5 p-8 rounded-[32px] border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-teal/5 blur-[60px] rounded-full"></div>
          
          <div className="space-y-3 relative">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black text-white/40 uppercase tracking-[0.2em]">Input Source</label>
              {file && !loading && (
                <button 
                  onClick={handleRemove}
                  className="text-[10px] font-black text-white/20 hover:text-red-400 uppercase tracking-widest transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="relative group">
              {!file ? (
                <>
                  <input 
                    type="file" 
                    accept="image/*,video/*" 
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="border-2 border-dashed border-white/10 group-hover:border-primary-teal/50 rounded-2xl p-10 text-center transition-all bg-black/20">
                    <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                       <span className="text-2xl text-primary-teal">{fileType === 'video' ? '🎬' : '🖼️'}</span>
                    </div>
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Inject Asset (Image/Video)</p>
                  </div>
                </>
              ) : (
                <div className="border border-white/10 rounded-2xl p-4 bg-black/40 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
                    {fileType === 'image' ? (
                      <img src={preview!} alt="Thumbnail" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl">🎬</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-[10px] font-black uppercase tracking-widest truncate">{file.name}</p>
                    <p className="text-white/20 text-[9px] font-medium tracking-widest uppercase">{(file.size / 1024).toFixed(1)} KB • {fileType.toUpperCase()}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-black text-white/40 uppercase tracking-[0.2em]">Cleanup Directives</label>
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Remove the semi-transparent logo from the top right corner..."
              className="w-full bg-black/60 border border-white/10 rounded-2xl p-5 text-sm focus:outline-none focus:border-primary-teal h-28 resize-none placeholder:text-white/10"
            />
          </div>

          {!loading ? (
            <div className="flex flex-col gap-3">
              <button 
                disabled={!file}
                onClick={() => handleRemedy('remedy')}
                className="group w-full py-5 bg-primary-teal disabled:opacity-30 disabled:grayscale hover:bg-[#009eb3] text-white font-black rounded-2xl shadow-xl shadow-[#008394]/20 transition-all flex items-center justify-center gap-3 tracking-[0.2em] text-xs uppercase"
              >
                <span>REMOVE LOGO / WATERMARK</span>
                <span className="group-hover:translate-x-1 transition-transform">✂️</span>
              </button>
              
              {fileType === 'image' && (
                <button 
                  disabled={!file}
                  onClick={() => handleRemedy('auto')}
                  className="group w-full py-5 bg-white/5 disabled:opacity-30 disabled:grayscale hover:bg-white/10 text-white font-black rounded-2xl border border-white/10 transition-all flex items-center justify-center gap-3 tracking-[0.2em] text-xs uppercase"
                >
                  <span>AUTO SHARPEN & CLEAR</span>
                  <span className="group-hover:translate-x-1 transition-transform">✨</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
               <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary-teal transition-all duration-700 ease-out" 
                    style={{ width: `${progress}%` }}
                  ></div>
               </div>
               <button 
                onClick={handleCancel}
                className="w-full py-5 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-black rounded-2xl border border-red-500/10 transition-all flex items-center justify-center gap-3 tracking-[0.2em] text-[10px] uppercase"
              >
                ABORT CLEANUP {Math.floor(progress)}%
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-7 flex flex-col gap-6">
        <div className="flex-1 bg-black/90 rounded-[40px] border border-white/10 flex flex-col items-center justify-center overflow-hidden min-h-[500px] relative shadow-2xl group">
          {loading && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-xl z-20 flex flex-col items-center justify-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 border-4 border-primary-teal/10 border-t-primary-teal rounded-full animate-spin shadow-[0_0_40px_rgba(0,131,148,0.2)]"></div>
              </div>
              <div className="space-y-2 text-center px-8">
                <p className="text-white font-black uppercase tracking-[0.4em] text-xs animate-pulse">
                  {activeMode === 'video' ? 'Reconstructing Sequence' : 'Neural Inpainting Active'}
                </p>
                <p className="text-primary-teal text-[10px] font-black uppercase tracking-widest">{Math.floor(progress)}% COMPLETE</p>
              </div>
            </div>
          )}

          {!preview && !result && !loading && (
            <div className="text-center p-12 space-y-8 max-w-sm">
              <div className="w-32 h-32 rounded-[40px] bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-5xl transform -rotate-3 transition-transform group-hover:rotate-0 duration-700">🔍</div>
              <p className="text-white/20 font-black uppercase tracking-[0.3em] text-[10px]">Awaiting Signal Input</p>
            </div>
          )}
          
          {(preview || result) && (
            <div className="relative w-full h-full flex items-center justify-center p-8">
              {fileType === 'image' || result?.startsWith('data:image') || (result && !result.endsWith('.mp4')) ? (
                 <img 
                 src={result || preview!} 
                 alt="Studio Master" 
                 className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl transition-all duration-1000"
               />
              ) : (
                <video 
                  src={result || preview!} 
                  className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" 
                  controls 
                  autoPlay 
                  loop
                />
              )}
              <div className="absolute top-10 left-10">
                <div className={`px-5 py-2 rounded-full font-black text-[9px] uppercase tracking-[0.3em] border shadow-2xl backdrop-blur-md transition-all ${result ? 'bg-primary-teal/20 border-primary-teal text-primary-teal' : 'bg-white/5 border-white/10 text-white/30'}`}>
                  {result ? 'MASTER OUTPUT' : 'INPUT ASSET'}
                </div>
              </div>
            </div>
          )}
        </div>

        {result && (
          <div className="flex gap-4 animate-in slide-in-from-bottom-6 duration-1000">
            <button 
              onClick={() => setResult(null)}
              className="flex-1 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white py-5 rounded-[20px] font-black text-[10px] uppercase tracking-[0.3em] transition-all border border-white/5"
            >
              Discard
            </button>
            <button 
              onClick={() => downloadMedia(result, `jybtv_remedy_master.${fileType === 'video' ? 'mp4' : 'png'}`)}
              className="flex-[2] bg-white text-black py-5 rounded-[20px] font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all hover:bg-gray-200 shadow-2xl"
            >
              <span>EXPORT STUDIO MASTER</span>
              <span className="text-xl">↓</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageEnhancer;