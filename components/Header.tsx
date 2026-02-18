import React from 'react';
import { AppTab } from '../types';

interface HeaderProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange }) => {
  const tabs: { id: AppTab; label: string; icon: string }[] = [
    { id: 'logo', label: 'Logo FX', icon: 'L' },
    { id: 'generate', label: 'Video Gen', icon: 'V' },
  ];

  return (
    <header className="sticky top-0 z-50 glass-effect border-b border-white/10 px-6 py-4 flex justify-between items-center">
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3">
          <div 
            onClick={() => onTabChange('logo')}
            className="cursor-pointer group relative flex items-center"
          >
            {/* Bold Cinematic JYB tv Logo */}
            <div className="flex items-baseline gap-1 select-none logo-animate">
              <span className="text-3xl font-black tracking-tighter text-[#008394] italic">JYB</span>
              <span className="text-xl font-bold tracking-tight text-[#008394]/80">tv</span>
            </div>
            
            {/* Optional glow effect behind text */}
            <div className="absolute -inset-2 bg-[#008394]/5 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>
        </div>
      </div>

      <nav className="flex gap-1.5 p-1 bg-black/40 rounded-full border border-white/5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 ease-out ${
              activeTab === tab.id 
                ? 'bg-primary-teal text-white shadow-xl shadow-[#008394]/40 scale-105' 
                : 'text-white/40 hover:text-white/70 hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-4">
        <div className="h-2 w-2 rounded-full bg-primary-teal animate-pulse shadow-[0_0_12px_#008394]"></div>
        <span className="text-[9px] font-black text-white/30 uppercase tracking-widest hidden md:inline">Live Studio</span>
      </div>
    </header>
  );
};

export default Header;