import React, { useState, useEffect } from 'react';
import { Send, Settings, QrCode, Monitor, Laptop, Minus, X, ArrowUpCircle } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenPairing: () => void;
  platform: string;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings, onOpenPairing, platform }) => {
  const isMac = platform === 'darwin';
  const appVersion = window.macdrop?.version || '1.2.0';

  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);
  const [updateDownloaded, setUpdateDownloaded] = useState<string | null>(null);

  useEffect(() => {
    if (window.macdrop?.onUpdateAvailable) {
      const unsub = window.macdrop.onUpdateAvailable((ver: string) => {
        setUpdateAvailable(ver);
      });
      return unsub;
    }
  }, []);

  useEffect(() => {
    if (window.macdrop?.onUpdateDownloaded) {
      const unsub = window.macdrop.onUpdateDownloaded((ver: string) => {
        setUpdateAvailable(null);
        setUpdateDownloaded(ver);
      });
      return unsub;
    }
  }, []);

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

  const handleInstallUpdate = () => {
    if (window.macdrop?.installUpdate) {
      window.macdrop.installUpdate();
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
            <span className="text-[10px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
              v{appVersion}
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
        {updateDownloaded && (
          <button
            onClick={handleInstallUpdate}
            title="Нажмите для перезапуска и обновления"
            className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 transition-all animate-pulse mr-1 shadow-sm"
          >
            <ArrowUpCircle className="w-3.5 h-3.5" />
            <span>Обновить до v{updateDownloaded}</span>
          </button>
        )}

        {updateAvailable && !updateDownloaded && (
          <span
            title="Загрузка обновления в фоне..."
            className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/25 mr-1"
          >
            <ArrowUpCircle className="w-3.5 h-3.5 animate-spin" />
            <span>Загрузка v{updateAvailable}...</span>
          </span>
        )}

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
