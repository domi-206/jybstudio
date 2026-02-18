import React, { useState, useRef, useEffect } from 'react';
import { geminiService, withRetry } from '../services/geminiService';
import { fileToBase64 } from '../utils';

const LogoAnimator: React.FC = () => {
  const [logo, setLogo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [niche, setNiche] = useState('Luxury');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [customDirection, setCustomDirection] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isGenerating) {
      setProgress(0);
      progressIntervalRef.current = window.setInterval(() => {
        setProgress(prev => {
          if (prev < 90) return prev + Math.random() * 1.5;
          if (prev < 98) return prev + Math.random() * 0.1;
          return prev;
        });
      }, 1000);
    } else {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isGenerating]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setLogo(selected);
      setPreview(URL.createObjectURL(selected));
      setVideoUrl(null);
      setError(null);
    }
  };

  const handleRemove = () => {
    setLogo(null);
    setPreview(null);
    setVideoUrl(null);
    setCustomDirection('');
    setError(null);
    setIsGenerating(false);
    setProgress(0);
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsGenerating(false);
    setStatusMessage("Cancelled.");
    setProgress(0);
  };

  const handleAnimate = async () => {
    if (!logo) return;
    setIsGenerating(true);
    setStatusMessage("Preparing...");
    setVideoUrl(null);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    try {
      const base64 = await fileToBase64(logo);
      if (signal.aborted) return;

      setStatusMessage("Synthesizing...");
      const op = await geminiService.generateLogoAnimation(
        base64,
        niche,
        logo.type,
        aspectRatio,
        resolution,
        customDirection
      );

      const result = await geminiService.pollOperation(op, signal);
      const downloadLink = result.response?.generatedVideos?.[0]?.video?.uri;

      if (downloadLink) {
        setStatusMessage("Finalizing...");
        setProgress(99);

        const blob = await withRetry(async () => {
          const apiKey = process.env.API_KEY;
          const response = await fetch(`${downloadLink}&key=${apiKey}`, { signal });
          if (!response.ok) {
            if (response.status === 429) {
              setStatusMessage("Pending (Quota)...");
              throw new Error("429");
            }
            throw new Error(`Download failed: ${response.statusText}`);
          }
          return await response.blob();
        });

        if (signal.aborted) return;
        setVideoUrl(URL.createObjectURL(blob));
        setProgress(100);
      } else {
        throw new Error("Generation complete, but no video data was found.");
      }
    } catch (err: any) {
      if (err.name === "AbortError" || err.message === "AbortError") {
        setStatusMessage("Cancelled.");
      } else {
        console.error("Logo Animation Error:", err);
        const errStr = JSON.stringify(err).toLowerCase() + String(err).toLowerCase();
        
        if (errStr.includes("requested entity was not found") || err.message === "RETRY_KEY_SELECTION") {
          setError("Key sync required. Authorization starting...");
          if (window.aistudio) {
            await window.aistudio.openSelectKey();
            setError("Sync complete. Please restart.");
          }
        } else if (errStr.includes("429") || errStr.includes("resource_exhausted") || err.message === "DAILY_QUOTA_EXHAUSTED") {
          setError("Quota Exhausted. Please wait or check settings.");
        } else {
          setError(err.message || "An unexpected error occurred.");
        }
      }
    } finally {
      setIsGenerating(false);
      setStatusMessage("");
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-8 flex flex-col lg:flex-row gap-12">
      <div className="w-full lg:w-1/3 space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-black mb-2 tracking-tighter uppercase italic">Logo FX</h2>
            <p className="text-white/40 text-xs font-medium uppercase tracking-widest">Cinematic logo reveals.</p>
          </div>
          {logo && !isGenerating && (
            <button 
              onClick={handleRemove}
              className="mt-2 text-[10px] font-black text-white/20 hover:text-red-400 uppercase tracking-[0.2em] transition-colors"
            >
              Remove
            </button>
          )}
        </div>

        <div className="space-y-6 bg-white/5 p-8 rounded-[32px] border border-white/10 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-teal/5 blur-[60px] rounded-full group-hover:bg-primary-teal/10 transition-colors"></div>
          
          <div className="space-y-3">
            <label className="text-xs font-black text-white/40 uppercase tracking-[0.2em]">Brand Asset</label>
            <div className="relative group">
              {!logo ? (
                <>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="border-2 border-dashed border-white/10 group-hover:border-primary-teal/50 rounded-2xl p-10 text-center transition-all bg-black/20">
                    <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                       <span className="text-2xl">⚡</span>
                    </div>
                    <p className="text-white/40 text-sm font-medium">Upload logo</p>
                  </div>
                </>
              ) : (
                <div className="border border-white/10 rounded-2xl p-4 bg-black/40 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 border border-white/10">
                    <img src={preview!} alt="Logo Thumbnail" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-xs font-bold truncate">{logo.name}</p>
                    <p className="text-white/20 text-[10px] uppercase font-black tracking-widest">{(logo.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="text-xs font-black text-white/40 uppercase tracking-[0.2em]">Market Niche</label>
              <select 
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl p-3.5 text-xs font-bold focus:outline-none focus:border-primary-teal text-white"
              >
                <option>Luxury</option>
                <option>Media</option>
                <option>Tech</option>
                <option>Sports</option>
                <option>Gaming</option>
                <option>Nature</option>
                <option>Corporate</option>
              </select>
            </div>
            <div className="space-y-3">
              <label className="text-xs font-black text-white/40 uppercase tracking-[0.2em]">Quality</label>
              <select 
                value={resolution}
                onChange={(e) => setResolution(e.target.value as any)}
                className="w-full bg-black/60 border border-white/10 rounded-xl p-3.5 text-xs font-bold focus:outline-none focus:border-primary-teal text-white"
              >
                <option value="720p">720p HD</option>
                <option value="1080p">1080p Full HD</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-black text-white/40 uppercase tracking-[0.2em]">Aspect Ratio</label>
            <select 
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value as any)}
              className="w-full bg-black/60 border border-white/10 rounded-xl p-3.5 text-xs font-bold focus:outline-none focus:border-primary-teal text-white"
            >
              <option value="16:9">Widescreen 16:9</option>
              <option value="9:16">Portrait 9:16</option>
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-black text-white/40 uppercase tracking-[0.2em]">Creative Direction</label>
            <textarea 
              value={customDirection}
              onChange={(e) => setCustomDirection(e.target.value)}
              placeholder="e.g., Use liquid gold effects..."
              className="w-full bg-black/60 border border-white/10 rounded-2xl p-5 text-sm focus:outline-none focus:border-primary-teal h-32 resize-none placeholder:text-white/10"
            />
          </div>

          <button 
            onClick={handleAnimate}
            disabled={isGenerating || !logo}
            className="w-full py-5 bg-primary-teal hover:bg-[#009eb3] disabled:opacity-30 disabled:grayscale text-white font-black rounded-2xl shadow-xl shadow-[#008394]/20 transition-all flex flex-col items-center gap-1 uppercase tracking-[0.2em]"
          >
            {isGenerating ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span className="text-xs">{Math.floor(progress)}% COMPLETE</span>
              </div>
            ) : 'ANIMATE BRAND'}
          </button>
          
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-[10px] font-black uppercase tracking-widest leading-relaxed animate-in fade-in slide-in-from-top-2">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="w-full lg:w-2/3 flex flex-col gap-6">
        <div className={`relative ${aspectRatio === '16:9' ? 'aspect-video' : 'aspect-[9/16] max-h-[75vh]'} bg-black/90 rounded-[40px] border border-white/10 overflow-hidden flex items-center justify-center shadow-2xl group mx-auto w-full`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary-teal/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
          
          {!videoUrl && !isGenerating && (
            <div className="text-center p-12 space-y-8 max-w-sm relative z-10">
              <div className="w-32 h-32 rounded-[40px] bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-5xl transform -rotate-6 shadow-2xl transition-transform group-hover:rotate-0 duration-500">💎</div>
              <div className="space-y-2">
                <p className="text-white/40 font-black uppercase tracking-[0.3em] text-lg">Awaiting Asset</p>
                <p className="text-white/20 text-xs font-medium uppercase tracking-widest">Production Ready</p>
              </div>
            </div>
          )}

          {isGenerating && (
            <div className="flex flex-col items-center gap-8 p-10 w-full max-w-md text-center z-10">
              <div className="relative">
                <div className="w-24 h-24 border-4 border-primary-teal/10 border-t-primary-teal rounded-full animate-spin shadow-[0_0_30px_rgba(0,131,148,0.3)]"></div>
                <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-primary-teal">{Math.floor(progress)}%</div>
              </div>
              <div className="space-y-4 w-full text-center">
                <p className="text-white font-black uppercase tracking-[0.4em] text-sm animate-pulse">{statusMessage}</p>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden relative shadow-inner">
                  <div 
                    className="h-full bg-primary-teal transition-all duration-700 ease-out shadow-[0_0_15px_rgba(0,131,148,0.5)]" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
              <button 
                onClick={handleCancel}
                className="mt-6 px-10 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-red-500/10 transition-all hover:scale-105"
              >
                Abort
              </button>
            </div>
          )}

          {videoUrl && (
            <video 
              src={videoUrl} 
              className="w-full h-full object-contain rounded-[38px] animate-in fade-in duration-1000" 
              controls 
              autoPlay 
              loop
            />
          )}
        </div>

        {videoUrl && (
          <div className="flex justify-between items-center p-8 bg-white/5 rounded-[32px] border border-white/10 animate-in fade-in slide-in-from-bottom-4 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary-teal/10 flex items-center justify-center text-primary-teal">
                <span className="animate-pulse">●</span>
              </div>
              <div>
                <p className="text-xs font-black text-white/80 uppercase tracking-widest">Master Ready</p>
                <p className="text-[10px] font-medium text-white/20 uppercase tracking-[0.2em]">5s Sequence • {resolution}</p>
              </div>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setVideoUrl(null)}
                className="px-8 py-4 bg-white/5 text-white/40 hover:text-white/80 font-black rounded-2xl transition-all text-[10px] uppercase tracking-widest border border-white/5"
              >
                Clear
              </button>
              <a 
                href={videoUrl} 
                download="jybtv_logo_master.mp4"
                className="px-10 py-4 bg-white text-black font-black rounded-2xl hover:bg-gray-200 transition-all text-xs uppercase tracking-[0.2em] shadow-2xl flex items-center gap-3"
              >
                <span>Export Master</span>
                <span className="text-lg">↓</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogoAnimator;