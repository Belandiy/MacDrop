import React from 'react';
import { Send, Settings, QrCode, Monitor, Laptop, Minus, X } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenPairing: () => void;
  platform: string;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings, onOpenPairing, platform }) => {
  const isMac = platform === 'darwin';

  const handleMinimize = () => {
    if (window.macdrop?.minimizeWindow) {
      window.macdrop.minimizeWindow();
    }
  };

  const handleClose = () => {
    if (window.macdrop?.closeWindow) {
      window.macdrop.closeWindow();
    }
  };

  return (
    <header
      style={{ WebkitAppRegion: 'drag' } as any}
      className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 bg-[#252528]/80 backdrop-blur-md sticky top-0 z-20 select-none cursor-default"
    >
      <div className="flex items-center gap-2.5 pointer-events-none">
        <img
          src="./logo.png"
          alt="MacDrop"
          className="w-8 h-8 rounded-xl object-cover shadow-lg shadow-blue-500/20 border border-white/10"
        />
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="font-semibold text-base tracking-tight text-white">MacDrop</h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
              v1.0
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-zinc-400">
            {isMac ? (
              <>
                <Laptop className="w-3 h-3 text-zinc-400" />
                <span>macOS Edition</span>
              </>
            ) : (
              <>
                <Monitor className="w-3 h-3 text-zinc-400" />
                <span>Windows Edition</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ WebkitAppRegion: 'no-drag' } as any} className="flex items-center gap-1">
        <button
          onClick={onOpenPairing}
          title="Связать устройства (QR / Код)"
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1 text-xs font-medium"
        >
          <QrCode className="w-4 h-4" />
          <span className="hidden sm:inline">Связать</span>
        </button>
        <button
          onClick={onOpenSettings}
          title="Настройки"
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-white/15 mx-0.5" />

        <button
          onClick={handleMinimize}
          title="Свернуть"
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={handleClose}
          title="Свернуть в трей"
          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/15 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
