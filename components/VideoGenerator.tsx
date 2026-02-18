import React, { useState, useRef, useEffect } from 'react';
import { geminiService, withRetry } from '../services/geminiService';

const VideoGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('Cinematic');
  const [orientation, setOrientation] = useState('16:9');
  const [resolution, setResolution] = useState('720p');
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

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsGenerating(false);
    setStatusMessage("Cancelled.");
    setProgress(0);
  };

  const handleRemove = () => {
    setVideoUrl(null);
    setPrompt('');
    setError(null);
    setStatusMessage('');
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setStatusMessage("Initializing...");
    setVideoUrl(null);
    setError(null);
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    try {
      const op = await geminiService.generateVideo(prompt, { style, orientation, resolution });
      setStatusMessage("Synthesizing...");
      
      const result = await geminiService.pollOperation(op, signal);
      const downloadLink = result.response?.generatedVideos?.[0]?.video?.uri;
      
      if (downloadLink) {
        setStatusMessage("Encoding...");
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
        console.error("Video Gen Error:", err);
        const errStr = JSON.stringify(err).toLowerCase() + String(err).toLowerCase();
        
        if (errStr.includes("requested entity was not found") || err.message === "RETRY_KEY_SELECTION") {
          setError("Key sync required. Studio authorization starting...");
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
            <h2 className="text-3xl font-black mb-2 tracking-tighter uppercase italic">Video Gen</h2>
            <p className="text-white/40 text-xs font-medium uppercase tracking-widest">Text-to-Sequence Production</p>
          </div>
          {(prompt || videoUrl) && !isGenerating && (
            <button 
              onClick={handleRemove}
              className="mt-2 text-[10px] font-black text-white/20 hover:text-red-400 uppercase tracking-[0.2em] transition-colors"
            >
              Reset
            </button>
          )}
        </div>

        <div className="space-y-6 bg-white/5 p-8 rounded-[32px] border border-white/10 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-teal/5 blur-[60px] rounded-full group-hover:bg-primary-teal/10 transition-colors"></div>
          
          <div className="space-y-3 relative">
            <label className="text-xs font-black text-white/40 uppercase tracking-[0.2em]">Prompt Directive</label>
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your scene in cinematic detail..."
              className="w-full bg-black/60 border border-white/10 rounded-2xl p-5 text-sm focus:outline-none focus:border-primary-teal h-44 resize-none placeholder:text-white/10 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="text-xs font-black text-white/40 uppercase tracking-[0.2em]">Art Style</label>
              <select 
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl p-3.5 text-xs font-bold focus:outline-none focus:border-primary-teal text-white"
              >
                <option>Cinematic</option>
                <option>Realistic</option>
                <option>Animation</option>
                <option>Cyberpunk</option>
                <option>Vintage</option>
              </select>
            </div>
            <div className="space-y-3">
              <label className="text-xs font-black text-white/40 uppercase tracking-[0.2em]">Quality</label>
              <select 
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl p-3.5 text-xs font-bold focus:outline-none focus:border-primary-teal text-white"
              >
                <option value="720p">720p HD</option>
                <option value="1080p">1080p Full HD</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-black text-white/40 uppercase tracking-[0.2em]">Canvas</label>
            <select 
              value={orientation}
              onChange={(e) => setOrientation(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-xl p-3.5 text-xs font-bold focus:outline-none focus:border-primary-teal text-white"
            >
              <option value="16:9">Widescreen 16:9</option>
              <option value="9:16">Portrait 9:16</option>
            </select>
          </div>

          <button 
            onClick={handleGenerate}
            disabled={isGenerating || !prompt}
            className="w-full py-5 bg-primary-teal hover:bg-[#009eb3] disabled:opacity-30 disabled:grayscale text-white font-black rounded-2xl shadow-xl shadow-[#008394]/20 transition-all flex flex-col items-center gap-1 uppercase tracking-[0.2em]"
          >
            {isGenerating ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span className="text-xs">{Math.floor(progress)}% COMPLETE</span>
              </div>
            ) : 'INITIALIZE PRODUCTION'}
          </button>
          
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-[10px] font-black uppercase tracking-widest leading-relaxed animate-in fade-in slide-in-from-top-2">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="w-full lg:w-2/3 flex flex-col gap-6">
        <div className="relative aspect-video bg-black/90 rounded-[40px] border border-white/10 overflow-hidden flex items-center justify-center shadow-2xl group">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary-teal/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
          
          {!videoUrl && !isGenerating && (
            <div className="text-center p-12 space-y-8 max-w-sm relative z-10">
              <div className="w-32 h-32 rounded-[40px] bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-5xl transform rotate-6 shadow-2xl transition-transform group-hover:rotate-12 duration-500">🎬</div>
              <div className="space-y-2">
                <p className="text-white/40 font-black uppercase tracking-[0.3em] text-lg">Timeline Empty</p>
                <p className="text-white/20 text-xs font-medium uppercase tracking-widest">Ready for deployment</p>
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
                Abort Sequence
              </button>
            </div>
          )}

          {videoUrl && (
            <video 
              src={videoUrl} 
              className="w-full h-full object-cover rounded-[38px] animate-in fade-in duration-1000" 
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
                <p className="text-xs font-black text-white/80 uppercase tracking-widest">Production Complete</p>
                <p className="text-[10px] font-medium text-white/20 uppercase tracking-[0.2em]">Ready for distribution • {resolution}</p>
              </div>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setVideoUrl(null)}
                className="px-8 py-4 bg-white/5 text-white/40 hover:text-white/80 font-black rounded-2xl transition-all text-[10px] uppercase tracking-widest border border-white/5"
              >
                Reset
              </button>
              <a 
                href={videoUrl} 
                download="jybtv_master.mp4"
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

export default VideoGenerator;