import React from 'react';
import { Send, Settings, QrCode, Monitor, Laptop } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenPairing: () => void;
  platform: string;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings, onOpenPairing, platform }) => {
  const isMac = platform === 'darwin';

  return (
    <header className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#252528]/80 backdrop-blur-md sticky top-0 z-20">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
          <Send className="w-4 h-4 text-white" />
        </div>
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

      <div className="flex items-center gap-1">
        <button
          onClick={onOpenPairing}
          title="Связать устройства (QR / Код)"
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1.5 text-xs font-medium"
        >
          <QrCode className="w-4 h-4" />
          <span className="hidden sm:inline">Связать</span>
        </button>
        <button
          onClick={onOpenSettings}
          title="Настройки"
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
