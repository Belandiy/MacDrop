import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Sliders,
  Power,
  Bell,
  FolderOpen,
  Unlink,
  RefreshCw,
  Terminal,
  Globe,
  CheckCircle2,
  AlertCircle,
  Languages
} from 'lucide-react';
import { DesignProps } from '../types';
import { useStableDropZone } from '../../hooks/useStableDropZone';
import { UpdatesSection } from '../../components/settings/UpdatesSection';
import { LogsSection } from '../../components/settings/LogsSection';
import { UpnpStatus } from '../../components/settings/UpnpStatusSection';
import { useTranslation, SupportedLanguage } from '../../i18n';

export const name = 'Studio Titanium Precision';
export const windowSize = { width: 780, height: 520 };
export const description = 'Studio titanium bento-grid with hardware aesthetic, precision dropzone, and inline configuration';

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function StudioTitaniumDesign(props: DesignProps) {
  const {
    config,
    status,
    activeTargetDeviceId,
    setActiveTargetDeviceAndSave,
    devices,
    platform,
    updateState,
    handleSelectFolder,
    handleOpenFolder,
    handleFilesDropped,
    handleToggleAutoStart,
    handleToggleNotifications,
    handleUnpairDevice,
    handleCheckForUpdates,
    handleInstallUpdate,
    handleChooseFiles,
    handlePairWithCode,
    handleSetLanguage
  } = props;

  const { t, language: ctxLanguage, setLanguage, availableLanguages } = useTranslation();
  const currentLang: SupportedLanguage = config?.language || ctxLanguage || 'ru';

  // View state: 'transfer' | 'history' | 'settings' (Inline views, NO modal for settings)
  const [activeView, setActiveView] = useState<'transfer' | 'history' | 'settings'>('transfer');
  const [settingsSubTab, setSettingsSubTab] = useState<'general' | 'nodes' | 'updates' | 'logs'>('general');

  // Modals state (only PIN and Web Drop QR)
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [pinDigits, setPinDigits] = useState(['', '', '', '', '', '']);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSubmitting, setPinSubmitting] = useState(false);

  // UPnP & Logs Error Count
  const [upnpStatus, setUpnpStatus] = useState<UpnpStatus | null>(null);
  const [errorCount, setErrorCount] = useState<number>(0);

  // Mobile Web Drop Info for Web Drop Tile
  const [mobileInfo, setMobileInfo] = useState<{
    ips: string[];
    port: number;
    token: string;
    url: string;
    computerName: string;
  } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const dropContainerRef = useRef<HTMLDivElement | null>(null);
  const pinInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Fetch Web Drop Mobile Info & UPnP status
  useEffect(() => {
    if (window.macdrop?.getMobileShareInfo) {
      window.macdrop.getMobileShareInfo().then((info) => {
        if (info) setMobileInfo(info);
      }).catch(() => {});
    }
    if (window.macdrop?.getUpnpStatus) {
      window.macdrop.getUpnpStatus().then(setUpnpStatus).catch(() => {});
    }
  }, []);

  // Fetch log errors count
  useEffect(() => {
    if (window.macdrop?.getLogs) {
      window.macdrop.getLogs().then((logs) => {
        const errors = logs.filter((l) => l.level === 'error').length;
        setErrorCount(errors);
      }).catch(() => {});
    }
    const unsubEntry = window.macdrop?.onLogEntry?.((entry) => {
      if (entry.level === 'error') {
        setErrorCount((prev) => prev + 1);
      }
    });
    const unsubCleared = window.macdrop?.onLogsCleared?.(() => {
      setErrorCount(0);
    });
    return () => {
      unsubEntry?.();
      unsubCleared?.();
    };
  }, []);

  // Keyboard navigation for escape key and Command+L for history
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPinModalOpen(false);
        setIsQrModalOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setActiveView((prev) => (prev === 'transfer' ? 'history' : 'transfer'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Stable drop zone hook - same principle as Classic Native
  const {
    isDragging,
    isOverZone,
    hoveredTargetId,
    draggedFileName,
    registerTarget
  } = useStableDropZone({
    zoneRef: dropContainerRef,
    onDropFiles: handleFilesDropped,
    hysteresisBuffer: 8,
    debounceMs: 100
  });

  // Current target device
  const targetDevice = devices.find((d) => d.id === activeTargetDeviceId) || devices[0];

  // Active transfer state (determines whether dropzone displays idle dropzone or in-flight telemetry HUD)
  const currentProgress = status?.currentProgress;
  const isTransferActive = Boolean(currentProgress);

  // Recent History
  const recentHistory: any[] = status?.recentHistory || [];

  // Effective Mobile Share URL
  const effectiveMobileUrl = mobileInfo?.url || 'http://192.168.1.104:4200';
  const displayHost = mobileInfo?.ips?.[0]
    ? `http://${mobileInfo.ips[0]}:${mobileInfo.port || 4200}`
    : 'http://192.168.1.104:4200';

  // Drop on specific device in sidebar list (like Classic Native)
  const handleFileDropOnTarget = async (e: React.DragEvent, deviceId?: string) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const filePaths = files
      .map((f: any) => {
        if (window.macdrop?.getPathForFile) {
          return window.macdrop.getPathForFile(f);
        }
        return f.path;
      })
      .filter(Boolean);

    if (filePaths.length > 0) {
      await handleFilesDropped(filePaths, deviceId || targetDevice?.id);
    }
  };

  // PIN input handlers
  const handlePinChange = (index: number, value: string) => {
    const cleanChar = value.slice(-1).toUpperCase();
    const nextDigits = [...pinDigits];
    nextDigits[index] = cleanChar;
    setPinDigits(nextDigits);

    if (cleanChar && index < 5) {
      pinInputRefs.current[index + 1]?.focus();
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinInputRefs.current[index - 1]?.focus();
    }
  };

  const handlePinPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i].toUpperCase();
    }
    setPinDigits(next);
    const nextFocus = Math.min(pasted.length, 5);
    pinInputRefs.current[nextFocus]?.focus();
  };

  const handleVerifyPin = async () => {
    const fullCode = pinDigits.join('').trim();
    if (fullCode.length < 4) {
      setPinError('Please enter a valid PIN or Pairing Code');
      return;
    }
    setPinSubmitting(true);
    setPinError(null);
    try {
      const res = await handlePairWithCode(fullCode);
      if (res.success) {
        setIsPinModalOpen(false);
        setPinDigits(['', '', '', '', '', '']);
      } else {
        setPinError(res.error || 'Failed to verify PIN');
      }
    } catch {
      setPinError('Connection error occurred');
    } finally {
      setPinSubmitting(false);
    }
  };

  // Switch to next recipient
  const handleCycleRecipient = () => {
    if (devices.length <= 1) return;
    const currentIndex = devices.findIndex((d) => d.id === targetDevice?.id);
    const nextIndex = (currentIndex + 1) % devices.length;
    setActiveTargetDeviceAndSave(devices[nextIndex].id);
  };

  // Calculate ETA string
  const getEtaString = () => {
    if (!currentProgress || !currentProgress.bytesPerSecond || currentProgress.bytesPerSecond === 0) {
      return '';
    }
    const remainingBytes = (currentProgress.total || 0) - (currentProgress.transferred || 0);
    if (remainingBytes <= 0) return 'Finishing...';
    const seconds = Math.ceil(remainingBytes / currentProgress.bytesPerSecond);
    if (seconds < 60) return `ETA ~ ${seconds}s`;
    return `ETA ~ ${Math.ceil(seconds / 60)}m`;
  };

  const appVersion = window.macdrop?.version || '2.4';
  const displayFolder = config.targetFolder
    ? config.targetFolder.replace(/^\/Users\/[^/]+/, '~')
    : '~/Downloads/MacDrop';

  const activeCount = devices.filter((d) => d.connectionMode !== 'offline').length;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-0 bg-[#050608] relative overflow-hidden select-none font-sans text-slate-200 antialiased">
      {/* Ambient Titanium Vignette */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(120,130,160,0.08),transparent_70%)]" />

      {/* macOS Pro Application Frame (780 x 520 or responsive viewport) */}
      <main className="w-full h-full max-w-[780px] max-h-[520px] rounded-[18px] bg-[#0D0E12] border border-[#272B38] titanium-border flex flex-col relative overflow-hidden shrink-0">
        {/* ========================================================
            WINDOW TITLEBAR (42px)
            ======================================================== */}
        <header
          style={{ WebkitAppRegion: 'drag' } as any}
          className="h-[42px] px-3.5 flex items-center justify-between border-b border-[#232734] bg-[#12141C] shrink-0"
        >
          {/* Left: Matte Traffic Lights & Brand */}
          <div style={{ WebkitAppRegion: 'no-drag' } as any} className="flex items-center gap-3.5">
            <div className="flex items-center gap-2 group">
              <button
                onClick={() => window.macdrop?.closeWindow()}
                title="Close"
                className="w-3 h-3 rounded-full bg-[#E5534B] border border-[#C23E37] opacity-85 hover:opacity-100 transition-opacity cursor-pointer"
              />
              <button
                onClick={() => window.macdrop?.minimizeWindow()}
                title="Minimize"
                className="w-3 h-3 rounded-full bg-[#DFA133] border border-[#BF8723] opacity-85 hover:opacity-100 transition-opacity cursor-pointer"
              />
              <button
                onClick={() => window.macdrop?.maximizeWindow?.()}
                title="Zoom"
                className="w-3 h-3 rounded-full bg-[#3BB346] border border-[#2D9936] opacity-85 hover:opacity-100 transition-opacity cursor-pointer"
              />
            </div>
            <div className="h-3 w-px bg-[#2B3040]" />
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold tracking-tight text-white uppercase font-mono">MACDROP</span>
              <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-[#1B1E2A] text-slate-400 border border-[#2A2E3D]">
                {appVersion}
              </span>
            </div>
          </div>

          {/* Center: Segmented Navigation Pill (Transfer | History | Settings) */}
          <nav
            style={{ WebkitAppRegion: 'no-drag' } as any}
            className="flex items-center p-0.5 rounded-lg bg-[#0A0B10] border border-[#252836] text-[11px] font-medium text-slate-400"
          >
            <button
              onClick={() => setActiveView('transfer')}
              className={`px-3 py-1 rounded-[6px] transition-all cursor-pointer ${
                activeView === 'transfer'
                  ? 'bg-[#1F2230] text-white shadow-sm font-semibold'
                  : 'hover:text-slate-200'
              }`}
            >
              {t('nav.transfer')}
            </button>
            <button
              onClick={() => setActiveView('history')}
              className={`px-3 py-1 rounded-[6px] transition-all cursor-pointer ${
                activeView === 'history'
                  ? 'bg-[#1F2230] text-white shadow-sm font-semibold'
                  : 'hover:text-slate-200'
              }`}
            >
              {t('nav.history')}
            </button>
            <button
              onClick={() => setActiveView('settings')}
              className={`px-3 py-1 rounded-[6px] transition-all cursor-pointer ${
                activeView === 'settings'
                  ? 'bg-[#1F2230] text-white shadow-sm font-semibold'
                  : 'hover:text-slate-200'
              }`}
            >
              {t('nav.settings')}
            </button>
          </nav>

          {/* Right: Telemetry Signal Readout (HUD button removed) */}
          <div style={{ WebkitAppRegion: 'no-drag' } as any} className="flex items-center gap-2">
            {isTransferActive ? (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amberSignal/15 text-amberSignal border border-amberSignal/30 text-[10.5px] font-mono font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amberSignal animate-ping" />
                <span>{t('status.streaming')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#161822] text-slate-400 border border-[#262A38] text-[10.5px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emeraldSignal" />
                <span>{t('status.standby')}</span>
              </div>
            )}
          </div>
        </header>

        {/* ========================================================
            VIEWPORT: TRANSFER (BENTO) | HISTORY | SETTINGS (INLINE)
            ======================================================== */}
        {activeView === 'transfer' ? (
          <div className="p-4 grid grid-cols-[280px_456px] gap-3 flex-1 overflow-hidden">
            {/* ================= LEFT COLUMN (280px) ================= */}
            <div className="flex flex-col gap-3 overflow-hidden">
              {/* TILE 1: NODE MESH (290px container) */}
              <section className="h-[290px] rounded-xl bg-[#151720] border border-[#252938] p-3 flex flex-col justify-between relative overflow-hidden">
                <div className="flex flex-col overflow-hidden">
                  {/* Header bar */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#232735] shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                        {t('devices.title')}
                      </span>
                      <span className="text-[10px] font-mono text-emeraldSignal bg-emeraldSignal/10 px-1 py-0.2 rounded border border-emeraldSignal/20">
                        {activeCount} {t('status.activeNodes')}
                      </span>
                    </div>
                  </div>

                  {/* Tabular Card List (supports drag & drop directly on nodes like Classic Native) */}
                  <div className="space-y-1.5 overflow-y-auto max-h-[190px] pr-0.5">
                    {devices.length === 0 ? (
                      <div className="p-3 rounded-lg bg-[#14161F] border border-[#232735] text-center">
                        <div className="text-[11px] font-mono text-slate-400">{t('devices.noDevices')}</div>
                        <div className="text-[9.5px] font-mono text-slate-500 mt-1">
                          {t('devices.noDevicesDesc')}
                        </div>
                      </div>
                    ) : (
                      devices.map((device) => {
                        const isSelected = targetDevice?.id === device.id;
                        const isRemote = device.connectionMode === 'remote';
                        const isOffline = device.connectionMode === 'offline';

                        return (
                          <div
                            key={device.id}
                            onClick={() => setActiveTargetDeviceAndSave(device.id)}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'copy';
                            }}
                            onDrop={(e) => handleFileDropOnTarget(e, device.id)}
                            className={`group cursor-pointer p-2 rounded-lg transition-all flex items-center justify-between ${
                              isSelected
                                ? 'bg-[#1D212E] border border-slate-400/30 shadow-[0_0_12px_rgba(0,0,0,0.4)]'
                                : 'bg-[#14161F] hover:bg-[#191C27] border border-[#232735] hover:border-slate-500/30'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-1">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  isOffline
                                    ? 'bg-slate-500'
                                    : isRemote
                                    ? 'bg-[#007AFF] animate-pulse'
                                    : 'bg-emeraldSignal animate-pulse'
                                }`}
                              />
                              <div className="truncate">
                                <div className="text-[11.5px] font-mono font-bold text-white truncate flex items-center gap-1.5">
                                  <span>{device.customName || device.originalName}</span>
                                </div>
                                <div className="text-[10px] font-mono text-slate-400 truncate">
                                  {device.ip || device.remoteIp || device.id}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end shrink-0">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-white/[0.08] text-slate-300 border border-white/10 uppercase">
                                {isRemote ? 'UDP Punch' : 'Direct TCP'}
                              </span>
                              <span
                                className={`text-[9px] font-mono mt-0.5 ${
                                  isSelected ? 'text-emeraldSignal' : 'text-slate-500'
                                }`}
                              >
                                {isSelected ? 'Primary' : isOffline ? 'Offline' : 'Active'}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Bottom Action: + Pair Node */}
                <button
                  onClick={() => {
                    setPinDigits(['', '', '', '', '', '']);
                    setPinError(null);
                    setIsPinModalOpen(true);
                  }}
                  className="w-full h-8 rounded-lg bg-[#1B1E29] hover:bg-[#222634] active:bg-[#151720] border border-[#2B3040] text-[11px] font-mono font-medium text-slate-300 hover:text-white flex items-center justify-center gap-1.5 transition-all hardware-btn cursor-pointer shrink-0"
                >
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>{t('devices.pairByPin')}</span>
                </button>
              </section>

              {/* TILE 2: VAULT TARGET (138px) */}
              <section className="h-[138px] rounded-xl bg-[#151720] border border-[#252938] p-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                      {t('folder.vaultStorage')}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {platform === 'darwin' ? 'APFS' : 'NTFS'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <div
                      onClick={handleOpenFolder}
                      className="flex items-center gap-1.5 text-slate-200 hover:text-white cursor-pointer truncate"
                      title={config.targetFolder}
                    >
                      <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <span className="font-medium truncate">{displayFolder}</span>
                    </div>
                  </div>

                  {/* Precision Segmented Calibrated Meter Bar */}
                  <div className="mt-2.5">
                    <div className="flex justify-between text-[9.5px] font-mono text-slate-400 mb-1">
                      <span>VOL_01</span>
                      <span className="text-slate-200">412 GB / 1 TB Free</span>
                    </div>
                    <div className="h-2 rounded bg-[#0A0C11] border border-[#232735] p-0.5 flex gap-0.5">
                      <div className="h-full bg-slate-300 rounded-[2px] w-[28%]" />
                      <div className="h-full bg-slate-500 rounded-[2px] w-[30%]" />
                      <div className="h-full bg-amberSignal/80 rounded-[2px] w-[6%]" />
                      <div className="h-full bg-transparent rounded-[2px] flex-1" />
                    </div>
                  </div>
                </div>

                {/* Dual Tactile Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={handleOpenFolder}
                    className="h-7 rounded-md bg-[#1B1E29] hover:bg-[#232735] border border-[#2B3040] text-[10px] font-mono text-slate-300 hover:text-white flex items-center justify-center gap-1 hardware-btn transition-colors cursor-pointer"
                  >
                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" x2="21" y1="14" y2="3" />
                    </svg>
                    {t('folder.revealInFinder')}
                  </button>
                  <button
                    onClick={handleSelectFolder}
                    className="h-7 rounded-md bg-[#1B1E29] hover:bg-[#232735] border border-[#2B3040] text-[10px] font-mono text-slate-300 hover:text-white hardware-btn transition-colors cursor-pointer"
                  >
                    {t('folder.change')}
                  </button>
                </div>
              </section>
            </div>

            {/* ================= RIGHT COLUMN (456px) ================= */}
            <div className="flex flex-col gap-3 overflow-hidden">
              {/* TILE 3: HERO DROP SURFACE (290px)
                  Drop zone mechanics identical to Classic Native (multi-target drag detection & stability) */}
              <section className="h-[290px] rounded-xl bg-[#151720] border border-[#252938] p-3 flex flex-col justify-between relative overflow-hidden">
                {/* Recipient Header Bar */}
                <div className="flex items-center justify-between pb-2 border-b border-[#232735] shrink-0 min-h-[30px]">
                  {!isDragging ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        {t('dropzone.recipient')}
                      </span>
                      <div
                        onClick={handleCycleRecipient}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#1C202C] border border-[#2D3344] text-[11px] font-mono text-white cursor-pointer hover:border-slate-400/50 transition-colors"
                        title={devices.length > 1 ? 'Click to cycle recipient' : undefined}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emeraldSignal" />
                        <span className="truncate max-w-[200px]">
                          {targetDevice ? (targetDevice.customName || targetDevice.originalName) : t('dropzone.noNodeSelected')}
                        </span>
                        {devices.length > 1 && (
                          <svg className="w-3 h-3 text-slate-400 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                          </svg>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-emeraldSignal font-mono text-[11px] font-medium animate-in fade-in duration-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-emeraldSignal animate-ping" />
                      <span>{isOverZone ? t('dropzone.releaseToTransmit') : t('dropzone.idleText')}</span>
                    </div>
                  )}

                  {isTransferActive && (
                    <span className="text-[10px] font-mono text-amberSignal font-semibold uppercase flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amberSignal animate-ping" />
                      {t('status.streaming')}
                    </span>
                  )}
                </div>

                {/* Drop Zone Box (Handles Idle, Multi-Target Drag Over, and Live Telemetry Stream HUD) */}
                <div
                  ref={dropContainerRef}
                  className={`my-2 flex-1 rounded-lg border transition-all relative overflow-hidden select-none ${
                    isTransferActive
                      ? 'border-[#2A2F40] bg-[#0F1017]'
                      : isOverZone
                      ? 'border-[1.5px] border-emeraldSignal bg-[#111823] shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                      : isDragging
                      ? 'border border-emeraldSignal/50 bg-[#161822]'
                      : 'border-dashed border-[#343B4E] hover:border-slate-400 bg-[#0F1017] crosshair-pattern'
                  }`}
                >
                  {isTransferActive ? (
                    /* ================= STATE 1: IN-FLIGHT STREAMING TELEMETRY HUD (hud: live) ================= */
                    <div className="w-full h-full flex flex-col justify-between p-3 font-mono">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-amberSignal font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amberSignal animate-ping" />
                          {t('status.activeStream')} #{currentProgress ? '4092' : '4092'}
                        </span>
                        <span className="text-slate-400">
                          {currentProgress?.bytesPerSecond
                            ? `${formatBytes(currentProgress.bytesPerSecond)}/s (Saturated 10GbE)`
                            : '114.8 MB/s (Saturated 10GbE)'}
                        </span>
                      </div>

                      {/* Big Numeric Readout */}
                      <div className="flex items-baseline justify-between my-auto px-2">
                        <div className="truncate pr-3">
                          <div className="text-3xl font-bold text-white tracking-tight">
                            {formatBytes(currentProgress?.transferred || 0)}{' '}
                            <span className="text-xs text-slate-400 font-normal">
                              / {formatBytes(currentProgress?.total || 0)}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[280px]">
                            {currentProgress?.filename || 'Transmitting payload...'}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-2xl font-bold text-emeraldSignal">
                            {Math.round(currentProgress?.percent || 0)}%
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {getEtaString()}
                          </div>
                        </div>
                      </div>

                      {/* Segmented Linear Transfer Track */}
                      <div className="space-y-1">
                        <div className="w-full bg-[#1A1D27] h-2 rounded overflow-hidden border border-[#2A2F40] p-0.5 flex">
                          <div
                            className="h-full bg-white rounded-[1px] transition-all duration-200"
                            style={{
                              width: `${Math.min(100, Math.max(2, currentProgress?.percent || 0))}%`
                            }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-slate-500">
                          <span>{t('dropzone.directSocket')}</span>
                          <div className="flex items-center gap-2">
                            <span>Threads: 12/12</span>
                            {window.macdrop?.cancelTransfer && (
                              <button
                                onClick={() => window.macdrop?.cancelTransfer?.()}
                                className="text-red-400 hover:text-red-300 hover:underline uppercase cursor-pointer"
                              >
                                {t('status.cancel')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* ================= STATE 2: IDLE DROP ZONE + MULTI-TARGET DRAG (hud: idle) ================= */
                    <>
                      {/* LAYER 1: Resting Idle View */}
                      <div
                        onClick={() => handleChooseFiles(targetDevice?.id)}
                        className={`absolute inset-0 w-full h-full flex flex-col items-center justify-center p-3 transition-opacity duration-150 cursor-pointer group ${
                          isDragging ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
                        }`}
                      >
                        <div className="w-12 h-12 rounded-lg bg-[#191C27] border border-[#2D3243] flex items-center justify-center text-slate-200 group-hover:text-white group-hover:border-slate-400 transition-all mb-2.5 shadow-sm">
                          <svg className="w-6 h-6 stroke-[1.8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M12 3v11m0 0l-4-4m4 4l4-4" strokeLinecap="square" strokeLinejoin="miter" />
                            <path d="M4 17v3h16v-3" strokeLinecap="square" strokeLinejoin="miter" />
                          </svg>
                        </div>
                        <div className="text-[12.5px] font-mono font-bold tracking-tight text-white uppercase">
                          {t('dropzone.dropPayload')}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          {t('dropzone.directSocket')}
                        </div>

                        {/* Dual Tactile Action Buttons */}
                        <div className="flex items-center gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleChooseFiles(targetDevice?.id)}
                            className="h-7 px-3 rounded-md bg-[#202432] hover:bg-[#282D3E] border border-[#32384B] text-[10.5px] font-mono text-slate-200 hover:text-white transition-colors hardware-btn cursor-pointer"
                          >
                            {t('dropzone.chooseFiles')}
                          </button>
                          <button
                            onClick={() => window.macdrop?.pickAndSendFolder?.(targetDevice?.id)}
                            className="h-7 px-3 rounded-md bg-[#161822] hover:bg-[#1E212D] border border-[#2A2F40] text-[10.5px] font-mono text-slate-400 hover:text-slate-200 transition-colors hardware-btn cursor-pointer"
                          >
                            {t('dropzone.chooseFolder')}
                          </button>
                        </div>
                      </div>

                      {/* LAYER 2: Drag-Over Multi-Target Grid (Exactly like Classic Native) */}
                      <div
                        className={`absolute inset-0 w-full h-full p-2.5 flex gap-2.5 transition-opacity duration-150 bg-[#0F1017] ${
                          isDragging ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                        }`}
                      >
                        {devices.length === 0 ? (
                          <div className="flex-1 h-full rounded-lg bg-[#141620] border border-[#252938] p-3 flex flex-col items-center justify-center text-center">
                            <span className="text-xs font-mono font-bold text-white uppercase">
                              {t('devices.noDevices')}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 mt-1">
                              {t('devices.noDevicesDesc')}
                            </span>
                          </div>
                        ) : (
                          devices.slice(0, 3).map((device) => {
                            const isHovered = hoveredTargetId === device.id;
                            const isRemote = device.connectionMode === 'remote';

                            return (
                              <div
                                key={device.id}
                                ref={(el) => registerTarget(device.id, el)}
                                className={`flex-1 h-full rounded-lg p-2.5 flex flex-col justify-between relative overflow-hidden transition-all duration-100 ${
                                  isHovered
                                    ? 'bg-[#16202B] border-[1.5px] border-emeraldSignal shadow-[inset_0_0_16px_rgba(16,185,129,0.15)]'
                                    : 'bg-[#141620] border border-[#252938]'
                                }`}
                              >
                                <div className="flex items-center justify-between pointer-events-none">
                                  <div className="flex items-center gap-1.5 truncate pr-1">
                                    <span
                                      className={`w-2 h-2 rounded-full shrink-0 ${
                                        isRemote ? 'bg-[#007AFF]' : 'bg-emeraldSignal'
                                      }`}
                                    />
                                    <span
                                      className={`text-[11.5px] font-mono font-bold truncate ${
                                        isHovered ? 'text-white' : 'text-slate-200'
                                      }`}
                                    >
                                      {device.customName || device.originalName}
                                    </span>
                                  </div>
                                  <span className="px-1.5 py-0.5 rounded text-[8.5px] font-mono bg-white/[0.06] text-slate-300 border border-white/10 uppercase shrink-0">
                                    {isRemote ? 'UDP Punch' : 'Direct TCP'}
                                  </span>
                                </div>

                                <div className="flex flex-col items-center justify-center my-auto pointer-events-none">
                                  <span
                                    className={`text-xs font-mono font-bold text-center uppercase tracking-tight ${
                                      isHovered ? 'text-emeraldSignal' : 'text-slate-400'
                                    }`}
                                  >
                                    {isHovered ? t('dropzone.releaseToTransmit') : t('dropzone.dropToTransmit')}
                                  </span>
                                  <span className="text-[9.5px] text-slate-500 font-mono mt-0.5">
                                    {device.ip || device.remoteIp || '192.168.1.x'}
                                  </span>
                                </div>

                                {isHovered && draggedFileName && (
                                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-[#1F2230] border border-[#2F3548] text-[9.5px] font-mono text-white flex items-center gap-1 shadow-sm pointer-events-none truncate max-w-[130px]">
                                    <span className="truncate">{draggedFileName}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Quick Terminal Footnote */}
                <div className="flex items-center justify-between text-[9.5px] font-mono text-slate-500 px-0.5 shrink-0">
                  <span>Direct P2P Link • MTU 9000</span>
                  <span>Buffer: RingBuffer-32MB</span>
                </div>
              </section>

              {/* BOTTOM SPLIT TILES (138px height): Tile 4 (284px) + Tile 5 (160px) */}
              <div className="grid grid-cols-[284px_160px] gap-3 h-[138px]">
                {/* TILE 4: TELEMETRY & LOG (284px) */}
                <section className="rounded-xl bg-[#151720] border border-[#252938] p-3 flex flex-col justify-between overflow-hidden">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#232735]">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                      {t('history.title')}
                    </span>
                    <span className="text-[9.5px] font-mono text-slate-500">
                      {recentHistory.length > 0 ? `${recentHistory.length} ${t('history.itemsToday')}` : `24 ${t('history.itemsToday')}`}
                    </span>
                  </div>

                  {/* Detailed 2-item recent transfer log */}
                  <div className="space-y-1.5 overflow-hidden">
                    {recentHistory.length > 0 ? (
                      recentHistory.slice(0, 2).map((item: any) => (
                        <div
                          key={item.id || item.timestamp}
                          onClick={handleOpenFolder}
                          className="flex items-center justify-between p-1.5 rounded bg-[#10121A] border border-[#202330] hover:border-[#2D3344] cursor-pointer transition-colors"
                        >
                          <div className="min-w-0 pr-1">
                            <div className="text-[10.5px] font-mono font-medium text-slate-200 truncate">
                              {item.filename}
                            </div>
                            <div className="text-[9px] font-mono text-slate-400 flex items-center gap-1.5">
                              <span className="text-emeraldSignal font-semibold">
                                {item.speed ? `${formatBytes(item.speed)}/s` : '114 MB/s'}
                              </span>
                              <span>•</span>
                              <span>{formatBytes(item.size)}</span>
                            </div>
                          </div>
                          <span className="px-1.5 py-0.5 rounded text-[8.5px] font-mono bg-emeraldSignal/10 text-emeraldSignal border border-emeraldSignal/20 shrink-0">
                            {t('history.completed')}
                          </span>
                        </div>
                      ))
                    ) : (
                      <>
                        <div
                          onClick={handleOpenFolder}
                          className="flex items-center justify-between p-1.5 rounded bg-[#10121A] border border-[#202330] hover:border-[#2D3344] cursor-pointer transition-colors"
                        >
                          <div className="min-w-0 pr-1">
                            <div className="text-[10.5px] font-mono font-medium text-slate-200 truncate">
                              Presentation_v2.key
                            </div>
                            <div className="text-[9px] font-mono text-slate-400 flex items-center gap-1.5">
                              <span className="text-emeraldSignal font-semibold">114 MB/s</span>
                              <span>•</span>
                              <span>1.2 GB</span>
                            </div>
                          </div>
                          <span className="px-1.5 py-0.5 rounded text-[8.5px] font-mono bg-emeraldSignal/10 text-emeraldSignal border border-emeraldSignal/20 shrink-0">
                            {t('history.completed')}
                          </span>
                        </div>
                        <div
                          onClick={handleOpenFolder}
                          className="flex items-center justify-between p-1.5 rounded bg-[#10121A] border border-[#202330] hover:border-[#2D3344] cursor-pointer transition-colors"
                        >
                          <div className="min-w-0 pr-1">
                            <div className="text-[10.5px] font-mono font-medium text-slate-200 truncate">
                              build.tar.gz
                            </div>
                            <div className="text-[9px] font-mono text-slate-400 flex items-center gap-1.5">
                              <span className="text-slate-300">verified sha256</span>
                              <span>•</span>
                              <span>420 MB</span>
                            </div>
                          </div>
                          <span className="px-1.5 py-0.5 rounded text-[8.5px] font-mono bg-white/5 text-slate-400 border border-white/10 shrink-0">
                            {t('history.stored')}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <div
                    onClick={() => setActiveView('history')}
                    className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-0.5 hover:text-slate-300 cursor-pointer transition-colors"
                  >
                    <span>{t('history.viewFullHistory')}</span>
                    <span>⌘L</span>
                  </div>
                </section>

                {/* TILE 5: WEB DROP (160px) */}
                <section
                  onClick={() => setIsQrModalOpen(true)}
                  className="rounded-xl bg-[#151720] hover:bg-[#181B26] border border-[#252938] hover:border-slate-500/40 p-2.5 flex flex-col items-center justify-between cursor-pointer transition-all group"
                >
                  <div className="w-full flex items-center justify-between">
                    <span className="text-[9.5px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                      {t('webDrop.title')}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emeraldSignal" />
                  </div>

                  {/* Dense Machine-Grade Vector QR Pattern */}
                  <div className="w-16 h-16 bg-white p-1 rounded-md shadow flex items-center justify-center group-hover:scale-105 transition-transform overflow-hidden">
                    <QRCodeSVG
                      value={effectiveMobileUrl}
                      size={56}
                      level="M"
                      includeMargin={false}
                    />
                  </div>

                  <div className="text-center">
                    <div className="text-[10px] font-mono font-bold text-slate-200 group-hover:text-white">
                      {t('webDrop.scanToConnect')}
                    </div>
                    <div className="text-[8.5px] font-mono text-slate-500">
                      {t('webDrop.zeroConfig')}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        ) : activeView === 'history' ? (
          /* ================= VIEW 2: FULL TELEMETRY HISTORY ================= */
          <div className="flex-1 p-4 flex flex-col overflow-hidden font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-[#232735] mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  {t('history.title')}
                </span>
                <span className="text-[10px] bg-white/10 text-slate-300 px-2 py-0.5 rounded border border-white/10">
                  {recentHistory.length} Recorded
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenFolder}
                  className="h-7 px-3 rounded-md bg-[#1B1E29] hover:bg-[#232735] border border-[#2B3040] text-[10.5px] text-slate-300 hover:text-white hardware-btn transition-colors cursor-pointer"
                >
                  {t('folder.openFolder')}
                </button>
                <button
                  onClick={() => setActiveView('transfer')}
                  className="h-7 px-3 rounded-md bg-[#25293A] hover:bg-[#2E3347] border border-[#343B52] text-[10.5px] text-white hardware-btn transition-colors cursor-pointer"
                >
                  {t('settings.backToTransfer')}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {recentHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs py-16">
                  <div>{t('history.emptyTitle')}</div>
                  <div className="text-[10px] mt-1 text-slate-600">
                    {t('history.emptyDesc')}
                  </div>
                </div>
              ) : (
                recentHistory.map((item: any, idx: number) => (
                  <div
                    key={item.id || idx}
                    onClick={handleOpenFolder}
                    className="p-2.5 rounded-lg bg-[#141620] border border-[#232735] hover:border-slate-500/40 flex items-center justify-between cursor-pointer transition-colors group"
                  >
                    <div className="min-w-0 pr-4">
                      <div className="text-xs font-bold text-slate-200 group-hover:text-white truncate">
                        {item.filename}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{formatBytes(item.size)}</span>
                        <span>•</span>
                        <span>{timeAgo(item.timestamp)}</span>
                        {item.speed && (
                          <>
                            <span>•</span>
                            <span className="text-emeraldSignal">{formatBytes(item.speed)}/s</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="px-2 py-0.5 rounded text-[9px] bg-emeraldSignal/10 text-emeraldSignal border border-emeraldSignal/20">
                        {t('history.completed')}
                      </span>
                      <span className="text-[11px] text-slate-400 group-hover:text-white">
                        {t('folder.revealInFinder')} →
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          /* ================= VIEW 3: INLINE SETTINGS (NO MODAL) ================= */
          <div className="flex-1 p-4 flex flex-col overflow-hidden font-mono">
            {/* Settings Top Bar & Sub-Tabs */}
            <div className="flex items-center justify-between pb-3 border-b border-[#232735] mb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white">
                  <Sliders className="w-3.5 h-3.5 text-slate-400" />
                  <span>{t('settings.configuration')}</span>
                </div>

                <div className="h-3 w-px bg-[#2B3040]" />

                {/* Sub-tab Navigation */}
                <div className="flex items-center p-0.5 rounded-lg bg-[#0A0B10] border border-[#252836] text-[11px]">
                  <button
                    onClick={() => setSettingsSubTab('general')}
                    className={`px-2.5 py-0.5 rounded-[5px] transition-colors cursor-pointer ${
                      settingsSubTab === 'general'
                        ? 'bg-[#1F2230] text-white font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t('settings.general')}
                  </button>
                  <button
                    onClick={() => setSettingsSubTab('nodes')}
                    className={`px-2.5 py-0.5 rounded-[5px] transition-colors cursor-pointer ${
                      settingsSubTab === 'nodes'
                        ? 'bg-[#1F2230] text-white font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t('devices.nodesCount', { count: devices.length })}
                  </button>
                  <button
                    onClick={() => setSettingsSubTab('updates')}
                    className={`px-2.5 py-0.5 rounded-[5px] transition-colors cursor-pointer ${
                      settingsSubTab === 'updates'
                        ? 'bg-[#1F2230] text-white font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t('settings.updates')}
                  </button>
                  <button
                    onClick={() => setSettingsSubTab('logs')}
                    className={`px-2.5 py-0.5 rounded-[5px] transition-colors cursor-pointer flex items-center gap-1 ${
                      settingsSubTab === 'logs'
                        ? 'bg-[#1F2230] text-white font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>{t('settings.logs')}</span>
                    {errorCount > 0 && (
                      <span className="px-1.5 py-0.1 bg-red-500/20 text-red-400 text-[9px] rounded-full">
                        {errorCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              <button
                onClick={() => setActiveView('transfer')}
                className="h-7 px-3 rounded-md bg-[#25293A] hover:bg-[#2E3347] border border-[#343B52] text-[10.5px] text-white hardware-btn transition-colors cursor-pointer flex items-center gap-1"
              >
                {t('settings.backToTransfer')}
              </button>
            </div>

            {/* Sub-tab Content Area */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {settingsSubTab === 'general' && (
                <div className="space-y-3">
                  {/* Interface Language Preference */}
                  <div className="p-3.5 rounded-xl bg-[#151720] border border-[#252938] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Languages className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10.5px] uppercase tracking-wider text-slate-400 font-semibold">
                          {t('settings.language')}
                        </span>
                      </div>
                      <span className="text-[9.5px] text-slate-500">
                        {t('settings.bilingualSystem')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#0A0C11] border border-[#202330]">
                      <div>
                        <div className="text-[11.5px] font-bold text-slate-200">
                          {t('settings.appLanguage')}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {t('settings.appLanguageDesc')}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 p-0.5 rounded-lg bg-[#141620] border border-[#2B3040]">
                        {availableLanguages.map((item) => (
                          <button
                            key={item.code}
                            type="button"
                            onClick={() => (handleSetLanguage ? handleSetLanguage(item.code) : setLanguage(item.code))}
                            className={`px-3 py-1 rounded-[5px] text-[11px] font-mono transition-all cursor-pointer ${
                              currentLang === item.code
                                ? 'bg-[#1F2230] text-emeraldSignal font-bold border border-emeraldSignal/30 shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {item.flag} {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Vault Storage Receptacle */}
                  <div className="p-3.5 rounded-xl bg-[#151720] border border-[#252938] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] uppercase tracking-wider text-slate-400 font-semibold">
                        {t('folder.vaultStorage')}
                      </span>
                      <span className="text-[9.5px] text-slate-500">
                        {platform === 'darwin' ? 'APFS' : 'NTFS'} Volume
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#0A0C11] border border-[#232735]">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <FolderOpen className="w-4 h-4 text-emeraldSignal shrink-0" />
                        <span className="text-[11.5px] text-slate-200 truncate">
                          {config.targetFolder || '~/Downloads/MacDrop'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={handleOpenFolder}
                          className="px-2.5 py-1 rounded bg-[#1B1E29] hover:bg-[#232735] border border-[#2B3040] text-[10px] text-slate-300 hover:text-white transition-colors cursor-pointer"
                        >
                          {t('folder.revealInFinder')}
                        </button>
                        <button
                          onClick={handleSelectFolder}
                          className="px-2.5 py-1 rounded bg-[#202434] hover:bg-[#282D42] border border-[#323850] text-[10px] text-slate-200 hover:text-white transition-colors cursor-pointer font-semibold"
                        >
                          {t('folder.change')}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* System Daemon Preferences */}
                  <div className="p-3.5 rounded-xl bg-[#151720] border border-[#252938] space-y-3">
                    <span className="text-[10.5px] uppercase tracking-wider text-slate-400 font-semibold block">
                      {t('settings.daemonPreferences')}
                    </span>

                    {/* Auto-Start */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#10121A] border border-[#202330]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-[#1B1E29] border border-[#2B3040] flex items-center justify-center text-slate-400">
                          <Power className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-[11.5px] font-bold text-slate-200">
                            {t('settings.autoStart')}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {t('settings.autoStartDesc')}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleAutoStart(!config.autoStart)}
                        className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                          config.autoStart ? 'bg-emeraldSignal' : 'bg-[#2B3040]'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform shadow ${
                            config.autoStart ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Notifications */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#10121A] border border-[#202330]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-[#1B1E29] border border-[#2B3040] flex items-center justify-center text-slate-400">
                          <Bell className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-[11.5px] font-bold text-slate-200">
                            {t('settings.notifications')}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {t('settings.notificationsDesc')}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleNotifications(!config.notifications)}
                        className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                          config.notifications ? 'bg-emeraldSignal' : 'bg-[#2B3040]'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform shadow ${
                            config.notifications ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Network Gateway & UPnP */}
                  <div className="p-3.5 rounded-xl bg-[#151720] border border-[#252938] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10.5px] uppercase tracking-wider text-slate-400 font-semibold">
                          {t('settings.upnpTitle')}
                        </span>
                      </div>
                      {upnpStatus?.active ? (
                        <span className="text-[9.5px] bg-emeraldSignal/10 text-emeraldSignal border border-emeraldSignal/20 px-2 py-0.5 rounded flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Port {upnpStatus.externalPort || 8384} Mapped
                        </span>
                      ) : (
                        <span className="text-[9.5px] bg-white/5 text-slate-400 border border-white/10 px-2 py-0.5 rounded">
                          {upnpStatus?.error || 'Local Subnet Mode'}
                        </span>
                      )}
                    </div>
                    <div className="p-2 rounded-lg bg-[#0A0C11] border border-[#202330] text-[10.5px] space-y-1">
                      <div className="flex justify-between text-slate-400">
                        <span>Local Peer Port:</span>
                        <span className="text-white">8384 TCP</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>WAN Address:</span>
                        <span className="text-white">{upnpStatus?.wanIp || 'Local LAN'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {settingsSubTab === 'nodes' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] uppercase tracking-wider text-slate-400 font-semibold">
                      Linked Nodes ({devices.length})
                    </span>
                    <button
                      onClick={() => {
                        setPinDigits(['', '', '', '', '', '']);
                        setPinError(null);
                        setIsPinModalOpen(true);
                      }}
                      className="px-2.5 py-1 rounded bg-[#1B1E29] hover:bg-[#232735] border border-[#2B3040] text-[10px] text-slate-200 hover:text-white transition-colors cursor-pointer"
                    >
                      + Pair Node by PIN
                    </button>
                  </div>

                  {devices.length === 0 ? (
                    <div className="p-8 rounded-xl bg-[#151720] border border-[#252938] text-center text-slate-500 text-xs">
                      No linked node devices registered. Click "+ Pair Node by PIN" to broadcast security handshake.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {devices.map((dev) => (
                        <div
                          key={dev.id}
                          className="p-3 rounded-xl bg-[#151720] border border-[#252938] flex items-center justify-between"
                        >
                          <div className="truncate pr-3">
                            <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emeraldSignal" />
                              <span>{dev.customName || dev.originalName}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                              {dev.ip || dev.remoteIp || '192.168.1.x'} • ID: {dev.id}
                            </div>
                          </div>
                          <button
                            onClick={() => handleUnpairDevice(dev.id)}
                            className="px-2.5 py-1 rounded bg-red-950/30 hover:bg-red-900/40 text-red-400 border border-red-900/50 text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Unlink className="w-3 h-3" />
                            <span>Unlink</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {settingsSubTab === 'updates' && (
                <div className="p-4 rounded-xl bg-[#151720] border border-[#252938]">
                  <UpdatesSection
                    updateState={updateState}
                    onCheckForUpdates={handleCheckForUpdates}
                    onInstallUpdate={handleInstallUpdate}
                    platform={platform}
                    appVersion={appVersion}
                  />
                </div>
              )}

              {settingsSubTab === 'logs' && (
                <div className="h-[360px] rounded-xl bg-[#151720] border border-[#252938] overflow-hidden p-2">
                  <LogsSection />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            PAIR NODE PIN MODAL
            ======================================================== */}
        {isPinModalOpen && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
            <div className="w-[340px] rounded-xl bg-[#141620] border border-[#2E3345] p-5 shadow-2xl space-y-3.5 font-mono">
              <div className="flex items-center justify-between pb-2 border-b border-[#242837]">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Pair Node by PIN
                </span>
                <button
                  onClick={() => setIsPinModalOpen(false)}
                  className="text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Enter security PIN broadcasted by target machine:
              </p>

              <div className="flex justify-center gap-1.5 py-1">
                {pinDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { pinInputRefs.current[i] = el; }}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(i, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(i, e)}
                    onPaste={handlePinPaste}
                    className={`w-9 h-10 text-center font-mono text-base font-bold bg-[#0A0C11] border rounded text-white focus:outline-none transition-colors ${
                      digit
                        ? 'border-slate-300'
                        : i === pinDigits.findIndex((d) => !d)
                        ? 'border-amberSignal'
                        : 'border-[#343A4E]'
                    }`}
                    placeholder="•"
                  />
                ))}
              </div>

              {pinError && (
                <div className="text-[10.5px] text-red-400 bg-red-950/30 border border-red-900/50 rounded p-1.5 text-center">
                  {pinError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setIsPinModalOpen(false)}
                  className="flex-1 py-1.5 rounded bg-[#1E212E] hover:bg-[#25293A] text-xs text-slate-300 border border-[#2E3345] cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVerifyPin}
                  disabled={pinSubmitting}
                  className="flex-1 py-1.5 rounded bg-white text-black font-semibold hover:bg-slate-200 text-xs cursor-pointer transition-colors disabled:opacity-50"
                >
                  {pinSubmitting ? 'Linking...' : 'Verify & Link'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            WEB DROP QR EXPANDED MODAL
            ======================================================== */}
        {isQrModalOpen && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
            <div className="w-[330px] rounded-xl bg-[#141620] border border-[#2E3345] p-5 shadow-2xl space-y-3 font-mono text-center">
              <div className="flex items-center justify-between pb-1 border-b border-[#242837]">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  {t('webDrop.localP2p')}
                </span>
                <button
                  onClick={() => setIsQrModalOpen(false)}
                  className="text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="w-40 h-40 bg-white p-2.5 rounded-lg mx-auto shadow-md flex items-center justify-center">
                <QRCodeSVG
                  value={effectiveMobileUrl}
                  size={140}
                  level="M"
                  includeMargin={false}
                />
              </div>

              <div
                onClick={() => {
                  navigator.clipboard.writeText(displayHost);
                  setCopiedUrl(true);
                  setTimeout(() => setCopiedUrl(false), 2000);
                }}
                className="text-xs text-emeraldSignal font-mono bg-[#0C0E14] border border-[#222838] py-1 px-2 rounded cursor-pointer hover:border-emeraldSignal/50 transition-colors flex items-center justify-center gap-1.5"
                title={t('webDrop.clickToCopy')}
              >
                <span>{displayHost}</span>
                <span className="text-[10px] text-slate-400">
                  {copiedUrl ? t('webDrop.copied') : '📋'}
                </span>
              </div>

              <p className="text-[10px] text-slate-400 leading-relaxed">
                {t('webDrop.modalDesc')}
              </p>

              <button
                onClick={() => setIsQrModalOpen(false)}
                className="w-full py-1.5 rounded bg-[#1E212E] hover:bg-[#25293A] text-xs text-slate-300 border border-[#2E3345] cursor-pointer transition-colors"
              >
                {t('window.close')}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
