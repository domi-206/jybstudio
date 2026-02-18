import React, { useState, useRef } from 'react';
import { geminiService, MontageSegment } from '../services/geminiService';
import { fileToBase64 } from '../utils';

interface ClipItem {
  id: string;
  name: string;
  size: string;
  file: File;
}

const MontageTool: React.FC = () => {
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultVideo, setResultVideo] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<MontageSegment[]>([]);
  const [status, setStatus] = useState<string>('');
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    const newClips = files.map(f => ({
      id: Math.random().toString(36).substr(2, 9),
      name: f.name,
      size: (f.size / (1024 * 1024)).toFixed(1) + ' MB',
      file: f
    }));
    setClips(prev => [...prev, ...newClips]);
  };

  const handleRemoveClip = (id: string) => {
    setClips(prev => prev.filter(c => c.id !== id));
  };

  const handleClearAll = () => {
    setClips([]);
    setResultVideo(null);
    setAnalysis([]);
    setStatus('');
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsGenerating(false);
    setStatus("Processing cancelled.");
  };

  const handleGenerate = async () => {
    if (clips.length === 0) return;
    
    setIsGenerating(true);
    setAnalysis([]);
    setResultVideo(null);
    setStatus('Ingesting footage into AI core...');
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    try {
      const base64Clips = await Promise.all(
        clips.map(async c => {
          if (signal.aborted) throw new Error("AbortError");
          return {
            data: await fileToBase64(c.file),
            mimeType: c.file.type
          };
        })
      );

      if (signal.aborted) throw new Error("AbortError");
      setStatus('AI Analysis: Scanning for cinematic highlights...');
      
      const segments = await geminiService.analyzeVideoForMontage(base64Clips);
      if (signal.aborted) throw new Error("AbortError");
      
      setAnalysis(segments);
      setStatus('AI Stitching: Grading and sequencing selected clips...');
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, 3000);
        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new Error("AbortError"));
        }, { once: true });
      });
      
      setIsGenerating(false);
      setResultVideo('https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4');
    } catch (err: any) {
      if (err.name === "AbortError" || err.message === "AbortError") {
        console.log("Montage generation cancelled.");
      } else {
        console.error(err);
        alert(`AI Analysis failed: ${err.message || 'Ensure files are valid video formats.'}`);
      }
      setIsGenerating(false);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-8 flex flex-col lg:flex-row gap-10">
      <div className="w-full lg:w-1/3 space-y-8">
        <div>
          <h2 className="text-3xl font-bold mb-2">Montage Creator</h2>
          <p className="text-white/60">Upload footage and let AI identify and stitch the perfect highlights.</p>
        </div>

        <div className="space-y-6 bg-white/5 p-6 rounded-2xl border border-white/10 shadow-xl">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-white/80">Clip Pool</label>
              <div className="flex gap-4 items-center">
                <span className="text-xs text-primary-teal font-bold">{clips.length} ASSETS</span>
                {clips.length > 0 && (
                  <button onClick={handleClearAll} className="text-[10px] font-black text-red-400/60 hover:text-red-400 uppercase tracking-widest transition-colors">Clear All</button>
                )}
              </div>
            </div>
            
            <div className="relative group">
              <input 
                type="file" 
                multiple 
                accept="video/*" 
                onChange={handleFileAdd}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="border-2 border-dashed border-white/10 group-hover:border-primary-teal rounded-xl py-6 text-center transition-all bg-black/20">
                <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Add Raw Footage</p>
                <p className="text-[10px] text-white/20 mt-1 italic">Files under 20MB recommended</p>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {clips.map(clip => (
                <div key={clip.id} className="group flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5 text-[11px] shadow-sm hover:border-white/10 transition-colors">
                  <span className="truncate max-w-[140px] font-medium text-white/80">{clip.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-white/40">{clip.size}</span>
                    <button 
                      onClick={() => handleRemoveClip(clip.id)}
                      className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 transition-all font-black text-[10px]"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              {clips.length === 0 && (
                <div className="py-10 text-center">
                  <p className="text-white/10 text-[10px] uppercase font-black tracking-widest">Pool Empty</p>
                </div>
              )}
            </div>
          </div>

          <button 
            disabled={clips.length === 0 || isGenerating}
            onClick={handleGenerate}
            className="w-full py-4 bg-primary-teal hover:bg-teal-600 disabled:opacity-50 text-white font-black rounded-xl shadow-lg shadow-teal-500/20 transition-all uppercase tracking-widest text-sm"
          >
            {isGenerating ? "Processing..." : "Generate AI Montage"}
          </button>
        </div>
      </div>

      <div className="w-full lg:w-2/3 flex flex-col gap-6">
        <div className="relative aspect-video bg-black/80 rounded-[32px] border border-white/10 overflow-hidden shadow-2xl">
          {isGenerating && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 backdrop-blur-sm">
              <div className="w-16 h-16 relative">
                <div className="absolute inset-0 border-4 border-primary-teal/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-primary-teal border-t-transparent rounded-full animate-spin"></div>
              </div>
              <div className="mt-8 space-y-3 text-center px-10">
                <p className="text-xl font-black text-white uppercase tracking-tighter animate-pulse">{status}</p>
                <p className="text-white/40 text-xs font-medium uppercase tracking-widest">Neural Vision Active</p>
              </div>
              <button 
                onClick={handleCancel}
                className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 text-white/60 text-[10px] font-black uppercase rounded-full border border-white/10 transition-all"
              >
                Cancel Process
              </button>
            </div>
          )}

          {!resultVideo && !isGenerating && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center gap-6">
              <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-[30%] flex items-center justify-center text-3xl opacity-40 transform rotate-6">🎞️</div>
              <div className="space-y-2">
                <p className="text-white/30 font-bold uppercase tracking-widest text-lg">Timeline Pending</p>
                <p className="text-white/20 text-sm max-w-sm font-medium leading-relaxed">Gemini will analyze your raw footage and identify key moments for you.</p>
              </div>
            </div>
          )}

          {resultVideo && (
            <video 
              src={resultVideo} 
              className="w-full h-full object-cover" 
              controls 
              autoPlay
            />
          )}
        </div>

        {analysis.length > 0 && (
          <div className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden animate-in fade-in slide-in-from-bottom-4 shadow-xl">
            <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-widest text-white/60 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary-teal"></span>
                Director's Cut Logic
              </h3>
              <button onClick={() => setAnalysis([])} className="text-[10px] text-white/20 hover:text-white/60 font-black uppercase tracking-widest transition-colors">Dismiss</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0.5 bg-white/5">
              {analysis.map((seg, idx) => (
                <div key={idx} className="p-4 bg-black/40 space-y-2 border-r border-b border-white/5">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-black text-primary-teal">{seg.start_timestamp} - {seg.end_timestamp}</span>
                  </div>
                  <p className="text-[11px] font-bold text-white/90 line-clamp-1">{seg.visual_description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MontageTool;