import React, { useState } from 'react';
import Header from './components/Header';
import VideoGenerator from './components/VideoGenerator';
import LogoAnimator from './components/LogoAnimator';
import { AppTab } from './types';

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('logo');

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="flex-1 overflow-y-auto">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 ease-out">
          {activeTab === 'logo' && <LogoAnimator />}
          {activeTab === 'generate' && <VideoGenerator />}
        </div>
      </main>

      <footer className="py-12 px-8 border-t border-white/5 bg-black/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-4 group">
            <img 
              src="logo.png" 
              alt="Jyb Logo" 
              className="w-12 h-auto opacity-40 group-hover:opacity-100 transition-opacity duration-500" 
              onError={(e) => e.currentTarget.style.display = 'none'}
            />
            <div className="flex flex-col">
              <span className="text-xs font-black text-white/40 uppercase tracking-[0.3em] group-hover:text-primary-teal transition-colors">Jyb Tv Studio</span>
              <span className="text-[9px] font-medium text-white/20 uppercase tracking-[0.2em]">Next-Gen Media Production</span>
            </div>
          </div>
          
          <div className="flex items-center gap-10">
            <nav className="flex gap-6">
              <a href="#" className="text-[10px] font-black text-white/20 hover:text-white uppercase tracking-widest transition-colors">Documentation</a>
              <a href="#" className="text-[10px] font-black text-white/20 hover:text-white uppercase tracking-widest transition-colors">Support</a>
            </nav>
            <div className="h-4 w-px bg-white/5"></div>
            <div className="flex items-center gap-6">
              <button 
                onClick={handleOpenKeySelector}
                className="text-[10px] text-white/40 hover:text-primary-teal font-black uppercase tracking-[0.2em] transition-all cursor-pointer border border-white/10 px-5 py-2 rounded-full hover:border-primary-teal/50 hover:bg-primary-teal/5 bg-black/20"
              >
                Sync Studio
              </button>
              <div className="text-[10px] font-medium text-white/10 tracking-widest uppercase">
                &copy; {new Date().getFullYear()} Jyb TV Production
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;