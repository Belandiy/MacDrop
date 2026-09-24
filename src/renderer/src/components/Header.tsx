import React from 'react';
import { Settings, QrCode, Monitor, Minus, X, Plus } from 'lucide-react';
import logoImg from '../assets/logo.png';
import packageJson from '../../../../package.json';
import { CircularUpdateProgress } from './CircularUpdateProgress';
import { UpdateStateInfo } from '../vite-env';

interface HeaderProps {
  onOpenSettings: (tab?: 'general' | 'updates' | 'logs') => void;
  onOpenPairing: () => void;
  platform?: string;
  updateState?: UpdateStateInfo;
  onInstallUpdate?: () => void;
}

interface BaseHeaderProps {
  appVersion: string;
  updateState: UpdateStateInfo;
  handleClose: () => void;
  handleMinimize: () => void;
  handleMaximize: () => void;
  handleInstallUpdate: () => void;
  onOpenSettings: (tab?: 'general' | 'updates' | 'logs') => void;
  onOpenPairing: () => void;
  onOpenUpdatesSettings: () => void;
}

const MacHeader: React.FC<BaseHeaderProps> = ({
  appVersion,
  updateState,
  handleClose,
  handleMinimize,
  handleMaximize,
  handleInstallUpdate,
  onOpenSettings,
  onOpenUpdatesSettings
}) => {
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

      {/* Center: Logo, Title, and Version */}
      <div className="flex items-center gap-2 pointer-events-none">
        <div className="w-4 h-4 rounded-md overflow-hidden shrink-0 shadow-sm border border-white/10">
          <img src={logoImg} alt="MacDrop" className="w-full h-full object-cover" />
        </div>
        <span className="font-bold text-xs text-slate-200 tracking-tight font-sans">MacDrop</span>
        <span className="font-mono text-[10px] text-slate-400 font-semibold px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08]">
          {appVersion}
        </span>
      </div>

      {/* Right: Actions (Settings & Circular Update Indicator) */}
      <div style={{ WebkitAppRegion: 'no-drag' } as any} className="flex items-center gap-1.5">
        {/* Circular progress bar with down arrow */}
        <CircularUpdateProgress
          updateState={updateState}
          onOpenUpdatesSettings={onOpenUpdatesSettings}
          onInstallUpdate={handleInstallUpdate}
        />

        <button
          onClick={() => onOpenSettings('general')}
          title="Настройки"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};

const WindowsHeader: React.FC<BaseHeaderProps> = ({
  appVersion,
  updateState,
  handleClose,
  handleMinimize,
  handleInstallUpdate,
  onOpenSettings,
  onOpenPairing,
  onOpenUpdatesSettings
}) => {
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
        {/* Circular progress bar with down arrow */}
        <CircularUpdateProgress
          updateState={updateState}
          onOpenUpdatesSettings={onOpenUpdatesSettings}
          onInstallUpdate={handleInstallUpdate}
        />

        <button
          onClick={onOpenPairing}
          title="Связать устройства (QR / Код)"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1 text-xs font-medium cursor-pointer"
        >
          <QrCode className="w-4 h-4" />
          <span className="hidden sm:inline">Связать</span>
        </button>
        <button
          onClick={() => onOpenSettings('general')}
          title="Настройки"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <Settings className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-white/15 mx-0.5" />

        <button
          onClick={handleMinimize}
          title="Свернуть"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={handleClose}
          title="Свернуть в трей"
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

const defaultUpdateState: UpdateStateInfo = { status: 'idle' };

export const Header: React.FC<HeaderProps> = React.memo(({
  onOpenSettings,
  onOpenPairing,
  platform,
  updateState = defaultUpdateState,
  onInstallUpdate
}) => {
  const isMac = platform === 'darwin';
  const appVersion = window.macdrop?.version || packageJson.version;

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
    if (onInstallUpdate) {
      onInstallUpdate();
    } else if (window.macdrop?.installUpdate) {
      window.macdrop.installUpdate();
    }
  };

  const handleOpenUpdatesSettings = () => {
    onOpenSettings('updates');
  };

  const baseProps: BaseHeaderProps = {
    appVersion,
    updateState,
    handleClose,
    handleMinimize,
    handleMaximize,
    handleInstallUpdate,
    onOpenSettings,
    onOpenPairing,
    onOpenUpdatesSettings: handleOpenUpdatesSettings
  };

  if (isMac) {
    return <MacHeader {...baseProps} />;
  }

  return <WindowsHeader {...baseProps} />;
});
