import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Sliders,
  Power,
  Bell,
  FolderOpen,
  Unlink,
  Globe,
  CheckCircle2,
  Languages,
  Laptop,
  Smartphone,
  HardDrive,
  Copy,
  Check,
  X,
  ChevronDown
} from 'lucide-react';
import { DesignProps } from '../types';
import { useStableDropZone } from '../../hooks/useStableDropZone';
import { UpdatesSection } from '../../components/settings/UpdatesSection';
import { LogsSection } from '../../components/settings/LogsSection';
import { UpnpStatus } from '../../components/settings/UpnpStatusSection';
import { useTranslation, SupportedLanguage } from '../../i18n';

export const name = 'VisionOS Spatial Glass';
export const windowSize = { width: 780, height: 520 };
export const description = 'VisionOS frosted glass with refractive spatial aesthetic, liquid glowing HUD, and ambient mesh aura';

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'только что';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}м назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}ч назад`;
  return new Date(timestamp).toLocaleDateString();
}

function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length > 1) {
    return parts.pop()?.toUpperCase() || 'FILE';
  }
  return 'FILE';
}

function getDeviceIcon(device: any) {
  const nameLower = (device?.customName || device?.originalName || '').toLowerCase();
  const typeLower = (device?.deviceType || '').toLowerCase();
  if (nameLower.includes('iphone') || nameLower.includes('phone') || typeLower.includes('phone')) {
    return <Smartphone className="w-3.5 h-3.5" />;
  }
  if (nameLower.includes('rig') || nameLower.includes('server') || nameLower.includes('pc') || nameLower.includes('windows')) {
    return <HardDrive className="w-3.5 h-3.5" />;
  }
  return <Laptop className="w-3.5 h-3.5" />;
}

export default function VisionSpatialDesign(props: DesignProps) {
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

  // View state: 'transfer' | 'history' | 'settings'
  const [activeView, setActiveView] = useState<'transfer' | 'history' | 'settings'>('transfer');
  const [settingsSubTab, setSettingsSubTab] = useState<'general' | 'storage' | 'nodes' | 'updates' | 'logs'>('general');

  // Modals state
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [pinDigits, setPinDigits] = useState(['', '', '', '', '', '']);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSubmitting, setPinSubmitting] = useState(false);

  // Demo toggle state for previewing the Spatial HUD (same as in user HTML template)
  const [isDemoActive, setIsDemoActive] = useState(false);

  // UPnP & Logs Error Count
  const [upnpStatus, setUpnpStatus] = useState<UpnpStatus | null>(null);
  const [errorCount, setErrorCount] = useState<number>(0);

  // Mobile Web Drop Info
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
      }).catch(() => { });
    }
    if (window.macdrop?.getUpnpStatus) {
      window.macdrop.getUpnpStatus().then(setUpnpStatus).catch(() => { });
    }
  }, []);

  // Fetch log errors count
  useEffect(() => {
    if (window.macdrop?.getLogs) {
      window.macdrop.getLogs().then((logs) => {
        const errors = logs.filter((l) => l.level === 'error').length;
        setErrorCount(errors);
      }).catch(() => { });
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
        if (activeView === 'settings') {
          setActiveView('transfer');
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setActiveView((prev) => (prev === 'transfer' ? 'history' : 'transfer'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeView]);

  // Stable drop zone hook
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

  // Active transfer state (true if live transfer or demo preview is on)
  const currentProgress = status?.currentProgress;
  const isTransferActive = Boolean(currentProgress) || isDemoActive;

  // Recent History (with sample fallback if empty so the preview looks stunning immediately)
  const realHistory = status?.recentHistory || [];
  const sampleHistory = [
    {
      id: 'demo-1',
      filename: 'archive_assets_q1.zip',
      size: 1.2 * 1024 * 1024 * 1024,
      speed: 112 * 1024 * 1024,
      timestamp: Date.now() - 2 * 60 * 1000,
      direction: 'in'
    },
    {
      id: 'demo-2',
      filename: 'ui_bento_mockup.png',
      size: 4.8 * 1024 * 1024,
      speed: 84 * 1024 * 1024,
      timestamp: Date.now() - 18 * 60 * 1000,
      direction: 'out'
    }
  ];
  const recentHistory = realHistory.length > 0 ? realHistory : sampleHistory;

  // Effective Mobile Share URL
  const effectiveMobileUrl = mobileInfo?.url || 'http://192.168.1.104:4200';
  const displayHost = mobileInfo?.ips?.[0]
    ? `http://${mobileInfo.ips[0]}:${mobileInfo.port || 4200}`
    : 'http://192.168.1.104:4200';

  // Drop on specific device in sidebar list
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
      setPinError('Введите 6-значный код сопряжения');
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
        setPinError(res.error || 'Не удалось выполнить сопряжение');
      }
    } catch {
      setPinError('Ошибка сетевого подключения');
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
      return isDemoActive ? 'Осталось ~ 8 сек' : '';
    }
    const remainingBytes = (currentProgress.total || 0) - (currentProgress.transferred || 0);
    if (remainingBytes <= 0) return 'Завершение...';
    const seconds = Math.ceil(remainingBytes / currentProgress.bytesPerSecond);
    if (seconds < 60) return `Осталось ~ ${seconds} сек`;
    return `Осталось ~ ${Math.ceil(seconds / 60)} мин`;
  };

  const appVersion = window.macdrop?.version || '2.4';
  const displayFolder = config.targetFolder
    ? config.targetFolder.replace(/^\/Users\/[^/]+/, '~')
    : '~/Downloads/MacDrop';

  // Active progress values (real or demo)
  const transferPercent = currentProgress?.percent ?? (isDemoActive ? 75 : 0);
  const transferSpeedMB = currentProgress?.bytesPerSecond
    ? (currentProgress.bytesPerSecond / (1024 * 1024)).toFixed(1)
    : isDemoActive ? '112.4' : '0.0';
  const transferredStr = currentProgress
    ? formatBytes(currentProgress.transferred || 0)
    : isDemoActive ? '3.6 GB' : '0 B';
  const totalStr = currentProgress
    ? formatBytes(currentProgress.total || 0)
    : isDemoActive ? '4.8 GB' : '0 B';
  const activeFileName = currentProgress?.filename || (isDemoActive ? 'FinalCut_SpatialRender_Master.dmg' : 'Передача файлов...');

  // SVG Gauge calculations
  const gaugeRadius = 26;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeOffset = gaugeCircumference - (gaugeCircumference * (transferPercent / 100));

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-0 bg-[radial-gradient(circle_at_50%_20%,#1e1b38_0%,#101222_45%,#080911_100%)] relative overflow-hidden select-none font-sans text-slate-100 antialiased">
      {/* ========================================================
          Atmospheric Fluid Ambient Glows (Spatial VisionOS aura)
          ======================================================== */}
      <div className="absolute -top-32 -left-20 w-[30rem] h-[30rem] bg-gradient-to-tr from-purple-600/20 to-indigo-500/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-36 -right-20 w-[32rem] h-[32rem] bg-gradient-to-bl from-sky-500/15 to-teal-400/10 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[28rem] bg-indigo-500/[0.06] rounded-full blur-[130px] pointer-events-none" />

      {/* ========================================================
          Main Application Window: Exactly 3:2 Ratio (780 x 520)
          ======================================================== */}
      <main className="w-full h-full max-w-[780px] max-h-[520px] rounded-[24px] bg-white/[0.06] backdrop-blur-[40px] saturate-[200%] border border-white/20 shadow-specular flex flex-col relative overflow-hidden shrink-0">

        {/* ========================================================
            TOP NAVIGATION & VISIONOS SPATIAL CHROME BAR (40px)
            ======================================================== */}
        <header
          style={{ WebkitAppRegion: 'drag' } as any}
          className="h-[40px] px-3.5 flex items-center justify-between border-b border-white/[0.12] bg-white/[0.03] shrink-0 select-none"
        >
          {/* Traffic lights & App Brand */}
          <div style={{ WebkitAppRegion: 'no-drag' } as any} className="flex items-center gap-3">
            {/* VisionOS Refractive Pill for Traffic Lights */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/30 border border-white/[0.1] shadow-inner">
              <button
                onClick={() => window.macdrop?.closeWindow()}
                title="Закрыть"
                className="w-2.5 h-2.5 rounded-full bg-[#FF5F56] shadow-[0_0_6px_rgba(255,95,86,0.6)] cursor-pointer hover:opacity-80 transition-opacity"
              />
              <button
                onClick={() => window.macdrop?.minimizeWindow()}
                title="Свернуть"
                className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E] shadow-[0_0_6px_rgba(255,189,46,0.5)] cursor-pointer hover:opacity-80 transition-opacity"
              />
              <button
                onClick={() => window.macdrop?.maximizeWindow?.()}
                title="Развернуть"
                className="w-2.5 h-2.5 rounded-full bg-[#27C93F] shadow-[0_0_6px_rgba(39,201,63,0.6)] cursor-pointer hover:opacity-80 transition-opacity"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="w-5.5 h-5.5 rounded-lg bg-gradient-to-b from-sky-400/30 to-purple-500/30 p-[1px] border border-white/30 shadow-[0_0_10px_rgba(56,189,248,0.25)] flex items-center justify-center">
                <svg className="w-3 h-3 text-sky-200" fill="none" stroke="currentColor" strokeWidth="2.3" viewBox="0 0 24 24">
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-[12.5px] font-semibold tracking-tight text-white/95">MacDrop</span>
              <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded-full bg-white/[0.08] text-purple-200 border border-purple-400/20 shadow-sm">
                v{appVersion}
              </span>
            </div>
          </div>

          {/* Center: Segmented Navigation Pill (Transfer | History | Settings) */}
          <nav
            style={{ WebkitAppRegion: 'no-drag' } as any}
            className="flex items-center p-0.5 rounded-full bg-black/30 border border-white/[0.12] text-[11px] font-medium text-slate-300 backdrop-blur-md"
          >
            <button
              onClick={() => setActiveView('transfer')}
              className={`px-3 py-0.5 rounded-full transition-all cursor-pointer ${activeView === 'transfer'
                ? 'glass-pill text-white shadow-sm font-semibold'
                : 'hover:text-white'
                }`}
            >
              {t('nav.transfer')}
            </button>
            <button
              onClick={() => setActiveView('history')}
              className={`px-3 py-0.5 rounded-full transition-all cursor-pointer ${activeView === 'history'
                ? 'glass-pill text-white shadow-sm font-semibold'
                : 'hover:text-white'
                }`}
            >
              {t('nav.history')}
            </button>
            <button
              onClick={() => setActiveView('settings')}
              className={`px-3 py-0.5 rounded-full transition-all cursor-pointer ${activeView === 'settings'
                ? 'glass-pill text-white shadow-sm font-semibold'
                : 'hover:text-white'
                }`}
            >
              {t('nav.settings')}
            </button>
          </nav>

          {/* Right Window Controls & Quick Actions */}
          <div style={{ WebkitAppRegion: 'no-drag' } as any} className="flex items-center gap-1.5">
            {/* Interactive Mode / Stream Demo Toggle */}
            <button
              onClick={() => setIsDemoActive((prev) => !prev)}
              className="glass-pill px-2.5 py-1 rounded-full text-[10.5px] font-medium text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Переключить демонстрацию активного потока HUD"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${isTransferActive
                  ? 'bg-emerald-400 shadow-[0_0_8px_#34D399] animate-pulse'
                  : 'bg-sky-400 shadow-[0_0_6px_#38BDF8]'
                  }`}
              />
              <span>{isTransferActive ? 'Стрим' : 'Ожидание'}</span>
            </button>

            {/* Mobile Web Bridge QR Button */}
            <button
              onClick={() => setIsQrModalOpen(true)}
              className="w-6.5 h-6.5 rounded-full glass-pill flex items-center justify-center text-slate-200 hover:text-white transition-colors cursor-pointer"
              title="Mobile Web Bridge (QR-код)"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect height="7" rx="1.5" width="7" x="3" y="3" />
                <rect height="7" rx="1.5" width="7" x="14" y="3" />
                <rect height="7" rx="1.5" width="7" x="3" y="14" />
                <path d="M14 14h2v2h-2zM18 14h3v3h-3zM14 18h3v3h-3zM19 19v2h2v-2z" />
              </svg>
            </button>

            {/* Settings Sheet Button */}
            <button
              onClick={() => setActiveView((prev) => (prev === 'settings' ? 'transfer' : 'settings'))}
              className={`w-6.5 h-6.5 rounded-full glass-pill flex items-center justify-center transition-colors cursor-pointer ${activeView === 'settings' ? 'text-purple-300 border-purple-400/40' : 'text-slate-200 hover:text-white'
                }`}
              title="Параметры"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* ========================================================
            VIEWPORT: TRANSFER (BENTO) | HISTORY | SETTINGS (SPATIAL SHEET)
            ======================================================== */}
        {activeView === 'transfer' ? (
          <div className="flex-1 p-3 grid grid-cols-[276px_1fr] grid-rows-[minmax(0,1fr)_136px] gap-2.5 relative overflow-hidden">
            {/* ========================================================
                BENTO BLOCK 1: SPATIAL PEER RADAR (276px width)
                ======================================================== */}
            <section className="glass-panel rounded-[20px] p-2.5 flex flex-col justify-between relative overflow-hidden">
              {/* Refractive sheen overlay */}
              <div className="absolute -top-12 -left-12 w-32 h-32 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-xl pointer-events-none" />

              <div className="flex flex-col overflow-hidden min-h-0">
                {/* Header */}
                <div className="flex items-center justify-between mb-2 px-1 shrink-0">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-300/80">
                    {t('devices.title')} ({devices.length})
                  </span>
                  <span className="flex items-center gap-1 text-[9.5px] font-mono text-sky-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_#38BDF8] animate-pulse" />
                    AirRadar
                  </span>
                </div>

                {/* Peer List (scrolls smoothly if > 3 devices) */}
                <div className="space-y-1.5 overflow-y-auto pr-0.5 flex-1 min-h-0">
                  {devices.length === 0 ? (
                    <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 text-center flex flex-col items-center justify-center my-auto">
                      <div className="w-7 h-7 rounded-lg bg-white/[0.08] flex items-center justify-center text-slate-400 mb-1">
                        <Laptop className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-[11px] font-semibold text-slate-300">{t('devices.noDevices')}</div>
                      <div className="text-[9px] text-slate-400/80 mt-0.5">
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
                          className={`group cursor-pointer p-2 rounded-xl transition-all flex items-center justify-between ${isSelected
                            ? 'bg-white/[0.12] border border-white/35 shadow-[0_4px_16px_rgba(168,85,247,0.2)]'
                            : 'bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-white/20'
                            }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-1">
                            <div
                              className={`w-7.5 h-7.5 rounded-lg border flex items-center justify-center shadow-sm shrink-0 ${isSelected
                                ? 'bg-gradient-to-br from-purple-500/40 to-sky-500/30 border-white/30 text-purple-200'
                                : 'bg-white/[0.08] border-white/20 text-slate-300'
                                }`}
                            >
                              {getDeviceIcon(device)}
                            </div>
                            <div className="truncate">
                              <div className="flex items-center gap-1">
                                <span className="text-[11.5px] font-semibold text-white truncate">
                                  {device.customName || device.originalName}
                                </span>
                                {isSelected && (
                                  <span className="text-[8.5px] px-1.5 py-0.2 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/30 font-medium shrink-0">
                                    Фокус
                                  </span>
                                )}
                              </div>
                              <div className="text-[9.5px] text-slate-300/90 flex items-center gap-1 mt-0.5 font-mono">
                                <span className={isRemote ? 'text-sky-300' : 'text-emerald-300'}>
                                  {isRemote ? 'WAN P2P' : '10 Gbps'}
                                </span>
                                <span>•</span>
                                <span className="text-slate-400">
                                  {device.ip || device.remoteIp || '0.8 ms'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end shrink-0">
                            <span
                              className={`inline-flex items-center px-1.5 py-0.2 rounded-full text-[8.5px] font-medium border ${isOffline
                                ? 'bg-white/5 text-slate-400 border-white/10'
                                : isRemote
                                  ? 'bg-sky-500/20 text-sky-200 border-sky-400/30'
                                  : 'bg-emerald-400/20 text-emerald-200 border-emerald-400/30 shadow-[0_0_8px_rgba(52,211,153,0.3)]'
                                }`}
                            >
                              {isOffline ? 'Offline' : isSelected ? 'Active' : 'LAN'}
                            </span>
                            <span className="text-[8.5px] text-slate-400 font-mono mt-0.5">
                              {isRemote ? 'UPnP Enc' : 'Direct LAN'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Pair Device Button */}
              <button
                onClick={() => {
                  setPinDigits(['', '', '', '', '', '']);
                  setPinError(null);
                  setIsPinModalOpen(true);
                }}
                className="w-full mt-1.5 py-1.5 px-3 rounded-xl glass-pill text-[11px] font-medium text-slate-100 flex items-center justify-center gap-1.5 transition-all group shadow-sm cursor-pointer shrink-0"
              >
                <svg className="w-3.5 h-3.5 text-sky-300 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{t('devices.pairByPin')}</span>
              </button>
            </section>

            {/* ========================================================
                BENTO BLOCK 3 (HERO): DROP REACTOR / SPATIAL HUD
                ======================================================== */}
            <section
              className="glass-panel rounded-[20px] p-3 flex flex-col justify-between relative overflow-hidden transition-all duration-300"
              id="dropReactorCard"
            >
              {/* Mesmerizing Luminous Radial Mesh Halo */}
              <div
                className={`absolute -top-16 -right-16 w-60 h-60 rounded-full blur-3xl pointer-events-none pulse-glow ${isTransferActive
                  ? 'bg-gradient-to-br from-sky-400/35 via-purple-500/30 to-teal-300/25'
                  : 'bg-gradient-to-br from-sky-400/20 via-purple-500/20 to-teal-400/10'
                  }`}
              />

              {!isTransferActive ? (
                /* ================= [STATE A: IDLE MODE + DRAG & DROP] ================= */
                <div className="h-full flex flex-col justify-between">
                  {/* Recipient Selector Capsule */}
                  <div className="flex items-center justify-between shrink-0">
                    <div
                      onClick={handleCycleRecipient}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.1] border border-white/25 shadow-sm text-[11.5px] backdrop-blur-md cursor-pointer hover:border-white/40 transition-colors"
                      title={devices.length > 1 ? 'Нажмите для смены получателя' : undefined}
                    >
                      <span className="text-slate-300/80 text-[10.5px]">{t('dropzone.recipient')}</span>
                      <div className="flex items-center gap-1.5 font-medium text-white truncate max-w-[180px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34D399]" />
                        <span className="truncate">{targetDevice ? (targetDevice.customName || targetDevice.originalName) : t('dropzone.noNodeSelected')}</span>
                      </div>
                      {devices.length > 1 && (
                        <ChevronDown className="w-3 h-3 text-slate-300 ml-0.5" />
                      )}
                    </div>
                  </div>

                  {/* Luminous Drop Surface (Interactive Reactor) */}
                  <div
                    ref={dropContainerRef}
                    onClick={() => handleChooseFiles(targetDevice?.id)}
                    className={`my-1.5 flex-1 rounded-[16px] border transition-all p-3 flex flex-col items-center justify-center text-center relative group cursor-pointer ${isOverZone
                      ? 'border-emerald-400/60 bg-white/[0.12] shadow-[0_0_30px_rgba(52,211,153,0.3)]'
                      : isDragging
                        ? 'border-sky-400/50 bg-white/[0.08]'
                        : 'border-white/20 bg-white/[0.04] hover:bg-white/[0.08] hover:border-sky-300/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]'
                      }`}
                  >
                    {isDragging ? (
                      /* Drag-Over Multi-Target Grid */
                      <div className="absolute inset-0 w-full h-full p-2 flex gap-2 bg-black/40 backdrop-blur-md rounded-[16px]">
                        {devices.length === 0 ? (
                          <div className="flex-1 h-full rounded-xl bg-white/[0.06] border border-white/20 p-2.5 flex flex-col items-center justify-center text-center">
                            <span className="text-xs font-semibold text-white">{t('devices.noDevices')}</span>
                            <span className="text-[10px] text-slate-400 mt-0.5">{t('devices.noDevicesDesc')}</span>
                          </div>
                        ) : (
                          devices.slice(0, 3).map((device) => {
                            const isHovered = hoveredTargetId === device.id;
                            const isRemote = device.connectionMode === 'remote';

                            return (
                              <div
                                key={device.id}
                                ref={(el) => registerTarget(device.id, el)}
                                className={`flex-1 h-full rounded-xl p-2 flex flex-col justify-between relative overflow-hidden transition-all ${isHovered
                                  ? 'bg-white/[0.15] border-2 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.35)]'
                                  : 'bg-white/[0.05] border border-white/15'
                                  }`}
                              >
                                <div className="flex items-center justify-between pointer-events-none">
                                  <div className="flex items-center gap-1.5 truncate pr-1">
                                    <span
                                      className={`w-2 h-2 rounded-full shrink-0 ${isRemote ? 'bg-sky-400' : 'bg-emerald-400'
                                        }`}
                                    />
                                    <span className="text-[11px] font-semibold truncate text-white">
                                      {device.customName || device.originalName}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex flex-col items-center justify-center my-auto pointer-events-none">
                                  <span
                                    className={`text-[11px] font-semibold text-center ${isHovered ? 'text-emerald-300' : 'text-slate-300'
                                      }`}
                                  >
                                    {isHovered ? t('dropzone.releaseToTransmit') : t('dropzone.dropToTransmit')}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                                    {device.ip || device.remoteIp || '192.168.1.x'}
                                  </span>
                                </div>

                                {isHovered && draggedFileName && (
                                  <div className="px-2 py-0.5 rounded-full bg-white/[0.15] border border-white/20 text-[9px] text-white flex items-center justify-center truncate pointer-events-none">
                                    <span className="truncate">{draggedFileName}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Mesmerizing Luminous Ring */}
                        <div className="relative mb-1.5 pointer-events-none">
                          <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-500 opacity-40 blur-md group-hover:opacity-75 transition-opacity" />
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-b from-white/20 to-white/5 border border-white/40 flex items-center justify-center text-sky-200 shadow-orbGlow group-hover:scale-105 transition-transform backdrop-blur-xl">
                            <svg className="w-5.5 h-5.5 transform group-hover:-translate-y-0.5 transition-transform text-white drop-shadow-[0_2px_6px_rgba(56,189,248,0.5)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>

                        <p className="text-[12.5px] font-semibold text-white tracking-tight drop-shadow-sm pointer-events-none">
                          Перетащите файлы в пространственную зону
                        </p>
                        <p className="text-[10px] text-slate-300/80 mt-0.5 max-w-sm pointer-events-none">
                          Передача без сжатия напрямую в память чипа со скоростью 10 Гбит/с
                        </p>

                        {/* VisionOS Glass Capsule Actions */}
                        <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleChooseFiles(targetDevice?.id)}
                            className="glass-pill px-3.5 py-1 rounded-full text-[11px] font-medium text-white shadow-sm hover:text-sky-200 transition-all cursor-pointer"
                            type="button"
                          >
                            {t('dropzone.chooseFiles')}
                          </button>
                          <button
                            onClick={() => window.macdrop?.pickAndSendFolder?.(targetDevice?.id)}
                            className="glass-pill px-3.5 py-1 rounded-full text-[11px] font-medium text-slate-200 hover:text-white transition-all cursor-pointer"
                            type="button"
                          >
                            {t('dropzone.chooseFolder')}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                /* ================= [STATE B: ACTIVE TRANSFER MODE - VISION SPATIAL HUD] ================= */
                <div className="h-full flex flex-col justify-between animate-in fade-in duration-200">
                  <div className="flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping shadow-[0_0_8px_#38BDF8]" />
                      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-sky-300 font-mono">
                        Spatial Direct Stream
                      </span>
                    </div>
                    {window.macdrop?.cancelTransfer ? (
                      <button
                        onClick={() => window.macdrop?.cancelTransfer?.()}
                        className="p-1 rounded-full glass-pill text-slate-300 hover:text-red-300 transition-colors cursor-pointer"
                        title="Приостановить передачу"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsDemoActive(false)}
                        className="p-1 rounded-full glass-pill text-slate-300 hover:text-red-300 transition-colors cursor-pointer"
                        title="Выйти из режима стрима"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Liquid HUD Capsule */}
                  <div className="my-auto py-2 px-4 rounded-[18px] bg-black/40 border border-white/20 shadow-[0_8px_24px_rgba(56,189,248,0.25)] flex items-center justify-between backdrop-blur-2xl">
                    <div className="space-y-0.5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold font-mono text-white tracking-tight drop-shadow-[0_2px_10px_rgba(255,255,255,0.3)]">
                          {transferSpeedMB}
                        </span>
                        <span className="text-xs font-mono text-sky-300 font-medium">MB/s</span>
                        <span className="text-[9.5px] font-mono text-emerald-300 bg-emerald-400/20 px-2 py-0.2 rounded-full border border-emerald-400/30 ml-1.5">
                          10 GbE Direct
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-300">
                        <span>
                          {transferredStr} / {totalStr}
                        </span>
                        <span>•</span>
                        <span className="text-sky-300 font-mono">{getEtaString()}</span>
                      </div>
                    </div>

                    {/* Liquid Circular Gauge */}
                    <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                      <svg className="w-16 h-16 transform -rotate-90">
                        <circle
                          className="text-white/10"
                          cx="32"
                          cy="32"
                          fill="transparent"
                          r={gaugeRadius}
                          stroke="currentColor"
                          strokeWidth="5"
                        />
                        <circle
                          className="progress-liquid"
                          cx="32"
                          cy="32"
                          fill="transparent"
                          r={gaugeRadius}
                          stroke="url(#visionLiquidGrad)"
                          strokeDasharray={gaugeCircumference}
                          strokeDashoffset={gaugeOffset}
                          strokeLinecap="round"
                          strokeWidth="5"
                        />
                        <defs>
                          <linearGradient id="visionLiquidGrad" x1="0%" x2="100%" y1="0%" y2="100%">
                            <stop offset="0%" stopColor="#38BDF8" />
                            <stop offset="100%" stopColor="#A855F7" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[13px] font-bold font-mono text-white drop-shadow">
                          {Math.round(transferPercent)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Active File Stream Info */}
                  <div className="space-y-1.5 shrink-0">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 truncate pr-2">
                        <div className="w-5 h-5 rounded-md bg-sky-500/25 border border-sky-300/30 flex items-center justify-center text-sky-200 shrink-0">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                        </div>
                        <span className="font-medium text-slate-100 truncate">{activeFileName}</span>
                      </div>
                      <span className="text-[10px] font-mono text-purple-300 shrink-0">Ultra-Stream 8/12</span>
                    </div>

                    {/* Sleek Glass Progress Tube */}
                    <div className="w-full h-1.5 rounded-full bg-white/[0.08] p-[1px] border border-white/15 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-500 rounded-full shadow-[0_0_12px_rgba(56,189,248,0.8)] transition-all duration-300"
                        style={{ width: `${Math.max(2, Math.min(100, transferPercent))}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* ========================================================
                BENTO BLOCK 2: STORAGE VAULT (276px width)
                ======================================================== */}
            <section className="glass-panel rounded-[20px] p-2.5 flex flex-col justify-between overflow-hidden">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-300/80">
                    {t('folder.vaultStorage')}
                  </span>
                  <span className="text-[9.5px] font-mono text-emerald-300 bg-emerald-400/20 px-2 py-0.2 rounded-full border border-emerald-400/30">
                    412 GB свободно
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    onClick={handleOpenFolder}
                    className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400/30 to-indigo-600/40 border border-white/30 flex items-center justify-center text-sky-200 shrink-0 shadow-sm cursor-pointer hover:scale-105 transition-transform"
                  >
                    <FolderOpen className="w-4 h-4 drop-shadow" />
                  </div>
                  <div className="truncate">
                    <div
                      onClick={handleOpenFolder}
                      className="text-[11.5px] font-semibold text-white flex items-center gap-1 cursor-pointer hover:underline truncate"
                      title={config.targetFolder}
                    >
                      <span>MacDrop Incoming</span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-300/80 truncate mt-0.5">
                      {displayFolder}
                    </div>
                  </div>
                </div>
              </div>

              {/* Liquid Gradient Storage Bar + Buttons */}
              <div className="space-y-1.5">
                <div className="w-full bg-black/30 h-1.5 rounded-full p-[1px] border border-white/10 flex overflow-hidden">
                  <div className="bg-gradient-to-r from-sky-400 to-indigo-500 h-full rounded-full w-[45%]" title="Занято MacDrop: 120 GB" />
                  <div className="bg-white/20 h-full rounded-full w-[25%] ml-1" title="Другие файлы: 68 GB" />
                </div>
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button
                    onClick={handleOpenFolder}
                    className="py-1 px-2 rounded-lg glass-pill text-[10px] font-medium text-slate-200 hover:text-white transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <svg className="w-3 h-3 text-sky-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" x2="21" y1="14" y2="3" />
                    </svg>
                    {t('folder.revealInFinder')}
                  </button>
                  <button
                    onClick={handleSelectFolder}
                    className="py-1 px-2 rounded-lg glass-pill text-[10px] font-medium text-slate-300 hover:text-white transition-colors cursor-pointer text-center"
                  >
                    {t('folder.change')}
                  </button>
                </div>
              </div>
            </section>

            {/* Bottom Right Bento Split: История (1fr) + Mobile Web (150px) */}
            <div className="grid grid-cols-[1fr_150px] gap-2.5">
              {/* ========================================================
                  BENTO BLOCK 4: RECENT TRANSFERS
                  ======================================================== */}
              <section className="glass-panel rounded-[20px] p-2.5 flex flex-col justify-between overflow-hidden">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-300/80">
                    {t('history.title')}
                  </span>
                  <span
                    onClick={() => setActiveView('history')}
                    className="text-[9.5px] text-sky-300 font-medium hover:underline cursor-pointer"
                  >
                    Все ({realHistory.length > 0 ? realHistory.length : 28})
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-1">
                  {recentHistory.slice(0, 2).map((item: any, idx: number) => {
                    const ext = getFileExtension(item.filename);
                    const isZip = ext === 'ZIP' || ext === 'TAR' || ext === 'GZ';

                    return (
                      <div
                        key={item.id || idx}
                        onClick={handleOpenFolder}
                        className="flex items-center justify-between p-1 rounded-lg hover:bg-white/[0.08] transition-colors group cursor-pointer border border-transparent hover:border-white/15"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 pr-1">
                          <div
                            className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ${isZip
                              ? 'bg-purple-500/25 border-purple-400/30 text-purple-200'
                              : 'bg-sky-500/25 border-sky-400/30 text-sky-200'
                              }`}
                          >
                            <span className="text-[8.5px] font-bold font-mono">{ext.slice(0, 3)}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] font-medium text-slate-100 group-hover:text-white truncate">
                              {item.filename}
                            </div>
                            <div className="text-[9.5px] text-slate-300/80 flex items-center gap-1 font-mono">
                              <span className={item.direction === 'out' ? 'text-sky-300 font-semibold' : 'text-emerald-300 font-semibold'}>
                                {item.direction === 'out' ? '↑ Исх' : '↓ Вх'}
                              </span>
                              <span>•</span>
                              <span>{formatBytes(item.size)}</span>
                            </div>
                          </div>
                        </div>
                        <span className="text-[9px] text-slate-400 font-mono shrink-0 ml-1">
                          {timeAgo(item.timestamp)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="text-[8.5px] text-slate-400 flex items-center justify-between pt-0.5 px-0.5">
                  <span>Нажмите для открытия</span>
                  <span className="font-mono">Finder ⌥</span>
                </div>
              </section>

              {/* ========================================================
                  BENTO BLOCK 5: MOBILE WEB BRIDGE (150px width)
                  ======================================================== */}
              <section
                onClick={() => setIsQrModalOpen(true)}
                className="glass-panel rounded-[20px] p-2 flex flex-col items-center justify-between cursor-pointer group hover:border-sky-300/40 transition-all text-center overflow-hidden"
              >
                <div className="w-full flex items-center justify-between">
                  <span className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-300/80">
                    Mobile Web
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38BDF8] group-hover:scale-125 transition-transform" />
                </div>

                {/* Frosted High-Contrast QR Code Card */}
                <div className="w-14 h-14 rounded-lg bg-white/95 p-1 shadow-[0_4px_16px_rgba(0,0,0,0.4)] flex items-center justify-center group-hover:scale-105 transition-transform border border-white">
                  <QRCodeSVG
                    value={effectiveMobileUrl}
                    size={48}
                    level="M"
                    includeMargin={false}
                  />
                </div>

                <div className="space-y-0.2">
                  <div className="text-[10.5px] font-semibold text-slate-100 group-hover:text-sky-300 transition-colors">
                    Быстрый Drop
                  </div>
                  <div className="text-[8.5px] text-slate-300/80">
                    Safari / Chrome
                  </div>
                </div>
              </section>
            </div>
          </div>
        ) : activeView === 'history' ? (
          /* ========================================================
              VIEW 2: FULL TELEMETRY HISTORY (VISIONOS GLASS)
              ======================================================== */
          <div className="flex-1 p-3.5 flex flex-col overflow-hidden font-sans">
            <div className="flex items-center justify-between pb-2.5 border-b border-white/10 mb-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold tracking-tight text-white">
                  {t('history.title')}
                </span>
                <span className="text-[10px] font-mono bg-white/[0.08] text-purple-200 px-2 py-0.5 rounded-full border border-purple-400/20">
                  {recentHistory.length} записей
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleOpenFolder}
                  className="px-2.5 py-1 rounded-full glass-pill text-[10.5px] font-medium text-slate-200 hover:text-white transition-colors cursor-pointer"
                >
                  {t('folder.openFolder')}
                </button>
                <button
                  onClick={() => setActiveView('transfer')}
                  className="px-2.5 py-1 rounded-full glass-pill text-[10.5px] font-medium text-white transition-colors cursor-pointer"
                >
                  {t('settings.backToTransfer')}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {recentHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs py-16">
                  <div>{t('history.emptyTitle')}</div>
                  <div className="text-[10px] mt-1 text-slate-500">{t('history.emptyDesc')}</div>
                </div>
              ) : (
                recentHistory.map((item: any, idx: number) => {
                  const ext = getFileExtension(item.filename);
                  return (
                    <div
                      key={item.id || idx}
                      onClick={handleOpenFolder}
                      className="p-2.5 rounded-xl glass-panel hover:bg-white/[0.1] flex items-center justify-between cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-3">
                        <div className="w-7.5 h-7.5 rounded-lg bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-200 font-mono text-[9.5px] font-bold shrink-0">
                          {ext.slice(0, 3)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[12px] font-medium text-white group-hover:text-sky-200 truncate">
                            {item.filename}
                          </div>
                          <div className="text-[9.5px] text-slate-300/80 flex items-center gap-1.5 mt-0.5 font-mono">
                            <span>{formatBytes(item.size)}</span>
                            <span>•</span>
                            <span>{timeAgo(item.timestamp)}</span>
                            {item.speed && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-300">{formatBytes(item.speed)}/s</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="px-2 py-0.2 rounded-full text-[9px] font-medium bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                          {t('history.completed')}
                        </span>
                        <span className="text-[10.5px] text-slate-400 group-hover:text-white">
                          В Finder →
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* ========================================================
              VIEW 3: SPATIAL SHEET MODAL (SETTINGS)
              ======================================================== */
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <div className="h-[40px] px-3.5 flex items-center justify-between border-b border-white/15 bg-white/[0.04] shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_8px_#C084FC]" />
                <span className="text-[11.5px] font-semibold text-white">Параметры MacDrop Vision</span>
              </div>
              <button
                onClick={() => setActiveView('transfer')}
                className="glass-pill px-2.5 py-0.5 rounded-full text-[10.5px] font-medium text-slate-200 hover:text-white cursor-pointer"
              >
                Готово (Esc)
              </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Left Subtab Navigation */}
              <div className="w-44 border-r border-white/10 p-2.5 space-y-1 bg-white/[0.02] shrink-0">
                <button
                  onClick={() => setSettingsSubTab('general')}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium transition-all cursor-pointer ${settingsSubTab === 'general'
                    ? 'bg-purple-500/25 text-purple-200 border border-purple-400/30 shadow-sm'
                    : 'hover:bg-white/[0.05] text-slate-300'
                    }`}
                >
                  Связь и Ultra-Mesh
                </button>
                <button
                  onClick={() => setSettingsSubTab('storage')}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium transition-all cursor-pointer ${settingsSubTab === 'storage'
                    ? 'bg-purple-500/25 text-purple-200 border border-purple-400/30 shadow-sm'
                    : 'hover:bg-white/[0.05] text-slate-300'
                    }`}
                >
                  Хранилище
                </button>
                <button
                  onClick={() => setSettingsSubTab('nodes')}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium transition-all cursor-pointer ${settingsSubTab === 'nodes'
                    ? 'bg-purple-500/25 text-purple-200 border border-purple-400/30 shadow-sm'
                    : 'hover:bg-white/[0.05] text-slate-300'
                    }`}
                >
                  {t('devices.nodesCount', { count: devices.length })}
                </button>
                <button
                  onClick={() => setSettingsSubTab('updates')}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium transition-all cursor-pointer ${settingsSubTab === 'updates'
                    ? 'bg-purple-500/25 text-purple-200 border border-purple-400/30 shadow-sm'
                    : 'hover:bg-white/[0.05] text-slate-300'
                    }`}
                >
                  Обновления
                </button>
                <button
                  onClick={() => setSettingsSubTab('logs')}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium transition-all cursor-pointer flex items-center justify-between ${settingsSubTab === 'logs'
                    ? 'bg-purple-500/25 text-purple-200 border border-purple-400/30 shadow-sm'
                    : 'hover:bg-white/[0.05] text-slate-300'
                    }`}
                >
                  <span>Журнал / Логи</span>
                  {errorCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-red-500/30 text-red-300 text-[9px] rounded-full border border-red-500/40">
                      {errorCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Subtab Content Area */}
              <div className="flex-1 p-3.5 space-y-3 overflow-y-auto">
                {settingsSubTab === 'general' && (
                  <div className="space-y-3">
                    {/* Interface Language Preference */}
                    <div className="glass-panel rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Languages className="w-3.5 h-3.5 text-purple-300" />
                          <span className="text-[11px] font-semibold text-white">
                            {t('settings.language')}
                          </span>
                        </div>
                        <span className="text-[9.5px] text-slate-400">
                          {t('settings.bilingualSystem')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-0.5">
                        <div>
                          <div className="text-[11.5px] font-medium text-slate-200">
                            {t('settings.appLanguage')}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {t('settings.appLanguageDesc')}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 p-0.5 rounded-full bg-black/25 border border-white/10">
                          {availableLanguages.map((item) => (
                            <button
                              key={item.code}
                              type="button"
                              onClick={() => (handleSetLanguage ? handleSetLanguage(item.code) : setLanguage(item.code))}
                              className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-medium transition-all cursor-pointer ${currentLang === item.code
                                ? 'glass-pill text-white font-semibold shadow-sm border-purple-400/40'
                                : 'text-slate-300 hover:text-white'
                                }`}
                            >
                              {item.flag} {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* System Daemon Preferences */}
                    <div className="glass-panel rounded-xl p-3 space-y-2.5">
                      <span className="text-[11px] font-semibold text-white block">
                        {t('settings.daemonPreferences')}
                      </span>

                      {/* Auto-Start */}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03] border border-white/10">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-white/[0.08] flex items-center justify-center text-slate-300">
                            <Power className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="text-[11.5px] font-semibold text-white">
                              {t('settings.autoStart')}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {t('settings.autoStartDesc')}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleAutoStart(!config.autoStart)}
                          className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${config.autoStart ? 'bg-gradient-to-r from-sky-400 to-purple-500' : 'bg-white/20'
                            }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform shadow ${config.autoStart ? 'translate-x-4' : 'translate-x-0'
                              }`}
                          />
                        </button>
                      </div>

                      {/* Notifications */}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03] border border-white/10">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-white/[0.08] flex items-center justify-center text-slate-300">
                            <Bell className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="text-[11.5px] font-semibold text-white">
                              {t('settings.notifications')}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {t('settings.notificationsDesc')}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleNotifications(!config.notifications)}
                          className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${config.notifications ? 'bg-gradient-to-r from-sky-400 to-purple-500' : 'bg-white/20'
                            }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform shadow ${config.notifications ? 'translate-x-4' : 'translate-x-0'
                              }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Network Gateway & UPnP */}
                    <div className="glass-panel rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-sky-300" />
                          <span className="text-[11px] font-semibold text-white">
                            {t('settings.upnpTitle')}
                          </span>
                        </div>
                        {upnpStatus?.active ? (
                          <span className="text-[9.5px] font-mono bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 px-2 py-0.2 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Port {upnpStatus.externalPort || 8384} Mapped
                          </span>
                        ) : (
                          <span className="text-[9.5px] font-mono bg-white/10 text-slate-300 border border-white/15 px-2 py-0.2 rounded-full">
                            {upnpStatus?.error || 'Local Subnet Mode'}
                          </span>
                        )}
                      </div>
                      <div className="p-2 rounded-lg bg-white/[0.03] border border-white/10 text-[10.5px] font-mono space-y-1">
                        <div className="flex justify-between text-slate-300">
                          <span>Local Peer Port:</span>
                          <span className="text-white font-medium">8384 TCP</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>WAN Address:</span>
                          <span className="text-white font-medium">{upnpStatus?.wanIp || 'Local LAN'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {settingsSubTab === 'storage' && (
                  <div className="space-y-3">
                    <div className="glass-panel rounded-xl p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-white">
                          {t('folder.vaultStorage')}
                        </span>
                        <span className="text-[9.5px] font-mono text-slate-400">
                          {platform === 'darwin' ? 'APFS' : 'NTFS'} Volume
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <FolderOpen className="w-4 h-4 text-sky-300 shrink-0" />
                          <span className="text-[11.5px] text-white truncate font-mono">
                            {config.targetFolder || '~/Downloads/MacDrop'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={handleOpenFolder}
                            className="glass-pill px-2.5 py-1 rounded-full text-[10.5px] font-medium text-slate-200 hover:text-white cursor-pointer"
                          >
                            {t('folder.revealInFinder')}
                          </button>
                          <button
                            onClick={handleSelectFolder}
                            className="glass-pill px-2.5 py-1 rounded-full text-[10.5px] font-semibold text-white cursor-pointer"
                          >
                            {t('folder.change')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {settingsSubTab === 'nodes' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-white">
                        Связанные узлы ({devices.length})
                      </span>
                      <button
                        onClick={() => {
                          setPinDigits(['', '', '', '', '', '']);
                          setPinError(null);
                          setIsPinModalOpen(true);
                        }}
                        className="glass-pill px-2.5 py-0.5 rounded-full text-[10.5px] font-medium text-white cursor-pointer"
                      >
                        + Сопряжение по PIN
                      </button>
                    </div>

                    {devices.length === 0 ? (
                      <div className="p-6 rounded-xl glass-panel text-center text-slate-400 text-xs">
                        Нет связанных устройств. Нажмите "+ Сопряжение по PIN", чтобы добавить устройство.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {devices.map((dev) => (
                          <div
                            key={dev.id}
                            className="p-2.5 rounded-xl glass-panel flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              <div className="w-7 h-7 rounded-lg bg-white/[0.08] flex items-center justify-center text-purple-200 shrink-0">
                                {getDeviceIcon(dev)}
                              </div>
                              <div className="truncate">
                                <div className="text-[11.5px] font-semibold text-white truncate">
                                  {dev.customName || dev.originalName}
                                </div>
                                <div className="text-[9.5px] text-slate-400 font-mono mt-0.5 truncate">
                                  {dev.ip || dev.remoteIp || '192.168.1.x'} • ID: {dev.id}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleUnpairDevice(dev.id)}
                              className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-[10.5px] font-medium flex items-center gap-1 hover:bg-red-500/30 transition-colors cursor-pointer"
                            >
                              <Unlink className="w-3 h-3" />
                              <span>Отвязать</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {settingsSubTab === 'updates' && (
                  <div className="glass-panel rounded-xl p-3">
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
                  <div className="h-[320px] glass-panel rounded-xl overflow-hidden p-1.5">
                    <LogsSection />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            OVERLAY 2: PIN MODAL (СВЯЗАТЬ УСТРОЙСТВО)
            ======================================================== */}
        {isPinModalOpen && (
          <div className="absolute inset-0 z-50 bg-[#0b0c16]/90 backdrop-blur-2xl flex items-center justify-center p-4">
            <div className="w-[340px] rounded-[20px] glass-panel p-4.5 shadow-2xl space-y-3.5 text-center border border-white/25">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-sky-500/30 text-sky-200 mx-auto flex items-center justify-center border border-white/30 shadow-[0_0_15px_rgba(56,189,248,0.3)]">
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>

              <div>
                <h3 className="text-xs font-bold text-white">Пространственное сопряжение</h3>
                <p className="text-[11px] text-slate-300/80 mt-0.5">
                  Введите 6-значный код доступа со второго экрана
                </p>
              </div>

              <div className="flex justify-center gap-1.5">
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
                    className={`w-8.5 h-10 text-center font-mono text-sm font-bold bg-white/[0.08] border rounded-lg text-white focus:outline-none transition-colors ${digit
                      ? 'border-sky-300'
                      : i === pinDigits.findIndex((d) => !d)
                        ? 'border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.4)]'
                        : 'border-white/30'
                      }`}
                    placeholder="●"
                  />
                ))}
              </div>

              {pinError && (
                <div className="text-[10px] text-red-300 bg-red-500/20 border border-red-500/30 rounded-lg p-1.5 text-center">
                  {pinError}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setIsPinModalOpen(false)}
                  className="flex-1 py-1.5 rounded-lg glass-pill text-[11px] font-medium text-slate-200 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  onClick={handleVerifyPin}
                  disabled={pinSubmitting}
                  className="flex-1 py-1.5 rounded-lg bg-gradient-to-r from-sky-400 to-purple-500 hover:opacity-90 text-[11px] font-semibold text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all cursor-pointer disabled:opacity-50"
                >
                  {pinSubmitting ? 'Проверка...' : 'Подтвердить'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            OVERLAY 3: QR MODAL (MOBILE WEB SERVER)
            ======================================================== */}
        {isQrModalOpen && (
          <div className="absolute inset-0 z-50 bg-[#0b0c16]/90 backdrop-blur-2xl flex items-center justify-center p-4">
            <div className="w-[320px] rounded-[20px] glass-panel p-4 shadow-2xl space-y-3 text-center border border-white/25">
              <div className="flex justify-between items-center pb-0.5">
                <span className="text-[11.5px] font-semibold text-white">Прямой доступ со смартфона</span>
                <button
                  onClick={() => setIsQrModalOpen(false)}
                  className="text-slate-300 hover:text-white text-xs cursor-pointer p-0.5"
                >
                  ✕
                </button>
              </div>

              <div className="w-36 h-36 bg-white rounded-xl p-2.5 mx-auto shadow-2xl flex items-center justify-center">
                <QRCodeSVG
                  value={effectiveMobileUrl}
                  size={124}
                  level="M"
                  includeMargin={false}
                />
              </div>

              <div className="space-y-1">
                <div
                  onClick={() => {
                    navigator.clipboard.writeText(displayHost);
                    setCopiedUrl(true);
                    setTimeout(() => setCopiedUrl(false), 2000);
                  }}
                  className="text-[11px] font-mono text-sky-300 font-medium glass-pill py-1 px-2.5 rounded-full inline-flex items-center gap-1.5 cursor-pointer hover:text-white"
                  title="Нажмите, чтобы скопировать ссылку"
                >
                  <span>{displayHost}</span>
                  {copiedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                </div>
                <p className="text-[10px] text-slate-300/80 leading-relaxed">
                  Наведите камеру смартфона. Файлы сохранятся без сторонних приложений.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
