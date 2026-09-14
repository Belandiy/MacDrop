import React, { useState, useEffect } from 'react';
import { Send, Settings, QrCode, Monitor, Laptop, Minus, X, ArrowUpCircle, Plus } from 'lucide-react';
import logoImg from '../assets/logo.png';
import packageJson from '../../../../package.json';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenPairing: () => void;
  platform?: string;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings, onOpenPairing, platform }) => {
  const isMac = platform === 'darwin';
  const appVersion = window.macdrop?.version || packageJson.version;

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

  const handleMaximize = () => {
    if (window.macdrop?.maximizeWindow) {
      window.macdrop.maximizeWindow();
    }
  };

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

  // macOS Titlebar (as in Demo 1 of preview.html)
  if (isMac) {
    return (
      <header
        style={{ WebkitAppRegion: 'drag' } as any}
        className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-[#12141c]/95 backdrop-blur-2xl sticky top-0 z-20 select-none cursor-default"
      >
        {/* Left: Traffic Lights (Close, Minimize, Maximize) */}
        <div style={{ WebkitAppRegion: 'no-drag' } as any} className="flex items-center gap-2 group">
          <button
            onClick={handleClose}
            title="Закрыть в трей"
            className="w-3 h-3 rounded-full bg-[#ff5f56] hover:brightness-110 active:brightness-90 transition-all flex items-center justify-center shadow-[0_0_8px_rgba(255,95,86,0.4)] cursor-pointer"
          >
            <X className="w-2 h-2 text-black/60 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          <button
            onClick={handleMinimize}
            title="Свернуть"
            className="w-3 h-3 rounded-full bg-[#ffbd2e] hover:brightness-110 active:brightness-90 transition-all flex items-center justify-center shadow-[0_0_8px_rgba(255,189,46,0.4)] cursor-pointer"
          >
            <Minus className="w-2 h-2 text-black/60 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          <button
            onClick={handleMaximize}
            title="Развернуть"
            className="w-3 h-3 rounded-full bg-[#27c93f] hover:brightness-110 active:brightness-90 transition-all flex items-center justify-center shadow-[0_0_8px_rgba(39,201,63,0.4)] cursor-pointer"
          >
            <Plus className="w-2 h-2 text-black/60 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>

        {/* Center: Logo, Title, and Version (Demo 1 style) */}
        <div className="flex items-center gap-2 pointer-events-none">
          <div className="w-4 h-4 rounded-md overflow-hidden shrink-0 shadow-sm border border-white/10">
            <img src={logoImg} alt="MacDrop" className="w-full h-full object-cover" />
          </div>
          <span className="font-bold text-xs text-slate-200 tracking-tight font-sans">MacDrop</span>
          <span className="font-mono text-[10px] text-slate-400 font-semibold px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08]">
            {appVersion}
          </span>
        </div>

        {/* Right: Actions (Settings & Updates) */}
        <div style={{ WebkitAppRegion: 'no-drag' } as any} className="flex items-center gap-1.5">
          {updateDownloaded && (
            <button
              onClick={handleInstallUpdate}
              title="Нажмите для перезапуска и обновления"
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 transition-all animate-pulse shadow-sm"
            >
              <ArrowUpCircle className="w-3 h-3" />
              <span>Обновить</span>
            </button>
          )}

          {updateAvailable && !updateDownloaded && (
            <span
              title="Загрузка обновления в фоне..."
              className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/25"
            >
              <ArrowUpCircle className="w-3.5 h-3.5 animate-spin" />
            </span>
          )}

          <button
            onClick={onOpenSettings}
            title="Настройки"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>
    );
  }

  // Windows Titlebar (kept as is)
  return (
    <header
      style={{ WebkitAppRegion: 'drag' } as any}
      className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-[#0e1017]/85 backdrop-blur-2xl sticky top-0 z-20 select-none cursor-default"
    >
      <div className="flex items-center gap-2.5 pointer-events-none">
        <div className="w-8 h-8 rounded-xl overflow-hidden shadow-md border border-white/20 relative shrink-0">
          <img src={logoImg} alt="MacDrop" className="w-full h-full object-cover" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="font-bold text-[15px] tracking-tight text-white font-sans">MacDrop</h1>
            <span className="text-[10px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              v{appVersion}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <Monitor className="w-3 h-3 text-slate-400" />
            <span>Windows Edition</span>
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
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1 text-xs font-medium"
        >
          <QrCode className="w-4 h-4" />
          <span className="hidden sm:inline">Связать</span>
        </button>
        <button
          onClick={onOpenSettings}
          title="Настройки"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-white/15 mx-0.5" />

        <button
          onClick={handleMinimize}
          title="Свернуть"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={handleClose}
          title="Свернуть в трей"
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
