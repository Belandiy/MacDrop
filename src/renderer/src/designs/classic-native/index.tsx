import React, { useState } from 'react';
import {
  X,
  MoreHorizontal,
  Ban,
  Folder
} from 'lucide-react';
import { DesignProps } from '../types';
import { PairedDevice } from '../../vite-env';
import { NativeDropZone } from '../../components/NativeDropZone';
import { WindowsLogoIcon, MacDesktopIcon, MacLaptopIcon } from '../../components/PairingModal';
import {
  DeviceContextMenu,
  DeviceHistoryModal,
  DeviceRenameModal,
  DeviceUnpairModal
} from '../../components/DeviceMenu';
import { useTranslation } from '../../i18n';

export const name = 'Classic Native (macOS)';
export const windowSize = { width: 760, height: 480 };

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function ClassicNativeDesign(props: DesignProps) {
  const {
    config,
    status,
    activeTargetDeviceId,
    setActiveTargetDeviceAndSave,
    devices,
    handleSelectFolder,
    handleOpenFolder,
    handleFilesDropped,
    handleOpenSettings,
    handleOpenPairing,
    handleChooseFiles,
    handleChooseFolder,
    handleUnpairDevice,
    handleDeviceUpdated,
    handleDeviceRemoved,
    platform = window.macdrop?.platform || 'darwin'
  } = props;

  const isMac =
    platform === 'darwin' ||
    (typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform || navigator.userAgent));

  const { t } = useTranslation();

  // Device context menu & modals state
  const [contextMenuDevice, setContextMenuDevice] = useState<PairedDevice | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  // Active hover target during drag & drop
  const [dropHoveredDeviceId, setDropHoveredDeviceId] = useState<string | null>(null);

  const [historyModalDevice, setHistoryModalDevice] = useState<PairedDevice | null>(null);
  const [renameModalDevice, setRenameModalDevice] = useState<PairedDevice | null>(null);
  const [unpairModalDevice, setUnpairModalDevice] = useState<PairedDevice | null>(null);

  const handleToggleReceive = async (device: PairedDevice) => {
    const newEnabled = device.receiveEnabled === false ? true : false;
    if (window.macdrop?.toggleDeviceReceive) {
      await window.macdrop.toggleDeviceReceive(device.id, newEnabled);
    }
    const updated = { ...device, receiveEnabled: newEnabled };
    handleDeviceUpdated?.(updated);
  };

  const handleSaveRename = async (device: PairedDevice, newName: string) => {
    if (window.macdrop?.updateDeviceName) {
      await window.macdrop.updateDeviceName(device.id, newName);
    }
    const updated = { ...device, customName: newName };
    handleDeviceUpdated?.(updated);
  };

  const handleConfirmUnpair = async (device: PairedDevice) => {
    if (handleUnpairDevice) {
      await handleUnpairDevice(device.id);
    } else if (window.macdrop?.removeDevice) {
      await window.macdrop.removeDevice(device.id);
    }
    handleDeviceRemoved?.(device.id);
  };


  // Resizable sidebar width (min: 170px, max: 340px, default: 220px)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('macdrop_sidebar_width');
      if (saved) {
        const parsed = Number(saved);
        if (!isNaN(parsed) && parsed >= 170 && parsed <= 340) {
          return parsed;
        }
      }
    } catch {}
    return 220;
  });

  const [isResizing, setIsResizing] = useState(false);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  React.useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Clamp between 170px and 340px
      const newWidth = Math.max(170, Math.min(340, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      try {
        localStorage.setItem('macdrop_sidebar_width', String(sidebarWidth));
      } catch {}
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, sidebarWidth]);

  // Active target device
  const targetDevice = devices.find((d) => d.id === activeTargetDeviceId) || devices[0];

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

  const rawProgress = status.currentProgress;
  const currentProgress = rawProgress ? {
    filename: rawProgress.filename || 'File',
    bytesTransferred: rawProgress.bytesTransferred ?? rawProgress.bytes_transferred ?? rawProgress.transferred ?? 0,
    totalBytes: rawProgress.totalBytes ?? rawProgress.total_bytes ?? rawProgress.total ?? 0,
    speedBps: rawProgress.speedBps ?? rawProgress.speed_bps ?? rawProgress.bytesPerSecond ?? 0,
    direction: rawProgress.direction || 'outgoing',
    peerDeviceId: rawProgress.peerDeviceId ?? rawProgress.peer_device_id ?? '',
    peerName: rawProgress.peerName ?? rawProgress.peer_name ?? '',
    percent: rawProgress.percent !== undefined
      ? rawProgress.percent
      : (rawProgress.totalBytes || rawProgress.total_bytes || rawProgress.total)
      ? Math.min(100, Math.round(((rawProgress.bytesTransferred ?? rawProgress.bytes_transferred ?? rawProgress.transferred ?? 0) / (rawProgress.totalBytes || rawProgress.total_bytes || rawProgress.total)) * 100))
      : 0,
  } : null;

  // Calculate ETA for active transfer
  const getEtaString = () => {
    if (!currentProgress || !currentProgress.speedBps || currentProgress.speedBps === 0) {
      return '';
    }
    const remainingBytes = (currentProgress.totalBytes || 0) - (currentProgress.bytesTransferred || 0);
    if (remainingBytes <= 0) return t('transfers.finishing');
    const seconds = Math.ceil(remainingBytes / currentProgress.speedBps);
    if (seconds < 60) return t('transfers.secLeft', { sec: seconds });
    return t('transfers.minLeft', { min: Math.ceil(seconds / 60) });
  };

  return (
    <div className="w-full h-full bg-transparent text-[#F2F2F7] flex flex-col overflow-hidden select-none font-sans antialiased">
      {/* ========================================================
          UNIFIED macOS TOOLBAR / TITLEBAR (38px)
          Rendered only on macOS (which uses overlay titlebar).
          On Windows: native DWM titlebar is used, so no duplicate header.
          ======================================================== */}
      {isMac && (
        <header
          data-tauri-drag-region
          style={{ WebkitAppRegion: 'drag' } as any}
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest('button, a, input, select, textarea, [data-no-drag]')) {
              return;
            }
            if (e.button === 0) {
              window.macdrop?.startDragging?.();
            }
          }}
          onDoubleClick={(e) => {
            if ((e.target as HTMLElement).closest('button, a, input, select, textarea, [data-no-drag]')) {
              return;
            }
            if (window.macdrop?.fillWindow) {
              window.macdrop.fillWindow();
            } else {
              window.macdrop?.maximizeWindow?.();
            }
          }}
          className="h-[38px] px-3 bg-[#1e1e22]/50 border-b border-white/[0.08] flex items-center justify-between shrink-0 relative select-none cursor-default backdrop-blur-md"
        >
          {/* Native macOS Traffic Lights sit over this 68px reserved zone */}
          <div className="w-[68px] h-full shrink-0 pointer-events-none" />

          {/* Centered Window Title */}
          <div data-tauri-drag-region className="absolute inset-x-0 flex items-center justify-center pointer-events-none">
            <span data-tauri-drag-region className="text-[13px] font-medium text-[#F2F2F7] tracking-tight">MacDrop</span>
          </div>

          {/* Settings Icon Button (Right) */}
          <button
            data-no-drag
            style={{ WebkitAppRegion: 'no-drag' } as any}
            onClick={() => handleOpenSettings('general')}
            className="w-6 h-6 flex items-center justify-center rounded text-[#8E8E93] hover:text-[#FFFFFF] hover:bg-[#2C2C2E] transition-colors cursor-pointer z-10"
            title={t('window.settings')}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </header>
      )}

      {/* ========================================================
          SPLIT-VIEW CONTAINER
          ======================================================== */}
      <div className="flex-1 flex overflow-hidden">
        {/* ================= LEFT SIDEBAR (Resizable) ================= */}
        <aside
          style={{ width: `${sidebarWidth}px` }}
          className={`${
            isMac ? 'bg-[#141416]/50' : 'bg-[#0e0f14]/70'
          } border-r border-white/[0.08] p-[12px_10px] flex flex-col justify-between shrink-0 select-none overflow-hidden backdrop-blur-md`}
        >
          {/* Top Section: Devices */}
          <div className="overflow-hidden">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider truncate">
                {t('devices.title')}
              </span>
              {!isMac && (
                <button
                  type="button"
                  data-no-drag
                  onClick={() => handleOpenSettings('general')}
                  className="w-5 h-5 flex items-center justify-center rounded text-[#8E8E93] hover:text-[#FFFFFF] hover:bg-[#2C2C2E] transition-colors cursor-pointer"
                  title={t('window.settings')}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                </button>
              )}
            </div>
            <nav className="mt-1 space-y-0.5 overflow-y-auto max-h-[calc(100vh-220px)]">
              {devices.length === 0 ? (
                <div className="px-2 py-2 text-[12px] text-[#8E8E93]">
                  {t('devices.noDevices')}
                </div>
              ) : (
                devices.map((device) => {
                  const isSelected = targetDevice && targetDevice.id === device.id;
                  const isRemote = device.connectionMode === 'remote';
                  const isOffline = device.connectionMode === 'offline';
                  const isReceiveDisabled = device.receiveEnabled === false;

                  const nameLower = (device.customName || device.originalName || '').toLowerCase();
                  const isWindows =
                    device.platform === 'win32' ||
                    nameLower.startsWith('desktop-') ||
                    nameLower.startsWith('win-') ||
                    nameLower.startsWith('laptop-') ||
                    nameLower.includes('pc') ||
                    nameLower.includes('windows');
                  const isLaptop =
                    nameLower.includes('air') ||
                    nameLower.includes('book') ||
                    nameLower.includes('laptop') ||
                    nameLower.includes('notebook');

                  const isDropHovered = dropHoveredDeviceId === device.id;

                  return (
                    <div
                      key={device.id}
                      data-device-id={device.id}
                      onClick={() => setActiveTargetDeviceAndSave(device.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenuPos({ x: e.clientX, y: e.clientY });
                        setContextMenuDevice(device);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'copy';
                      }}
                      onDrop={(e) => handleFileDropOnTarget(e, device.id)}
                      className={`w-full h-8 px-2 rounded-[6px] flex items-center justify-between text-[13px] font-normal transition-all text-left cursor-pointer group ${
                        isDropHovered
                          ? 'bg-[#007AFF]/35 border border-[#007AFF] text-white shadow-sm ring-1 ring-[#007AFF]/50'
                          : isSelected
                          ? 'bg-[#007AFF] text-white shadow-sm'
                          : 'text-[#E5E5EA] hover:bg-[#282828]'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate min-w-0 pr-1">
                        {/* Platform Icon */}
                        <span className="shrink-0 flex items-center justify-center">
                          {isWindows ? (
                            <WindowsLogoIcon className="w-3.5 h-3.5" isSelected={isSelected} />
                          ) : isLaptop ? (
                            <MacLaptopIcon className="w-4 h-4" isSelected={isSelected} />
                          ) : (
                            <MacDesktopIcon className="w-4 h-4" isSelected={isSelected} />
                          )}
                        </span>

                        {/* Device Name */}
                        <span className="truncate">{device.customName || device.originalName}</span>
                      </span>

                      {/* Right side: Receive disabled warning, Status dot & mode, More Options button */}
                      <span className="flex items-center gap-1.5 shrink-0 ml-1">
                        {isReceiveDisabled && (
                          <span
                            title={t('devices.receiveDisabled')}
                            className={`shrink-0 ${isSelected ? 'text-white/90' : 'text-[#FF9500]'}`}
                          >
                            <Ban className="w-3 h-3" />
                          </span>
                        )}

                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            isRemote
                              ? isSelected
                                ? 'bg-white'
                                : 'bg-[#007AFF]'
                              : isOffline
                              ? 'bg-[#636366]'
                              : 'bg-[#34C759]'
                          }`}
                        />
                        <span
                          className={`text-[10px] font-medium ${
                            isSelected ? 'text-white/80' : 'text-[#8E8E93]'
                          }`}
                        >
                          {isRemote ? 'P2P' : isOffline ? '' : 'LAN'}
                        </span>

                        {/* More Options (...) Button */}
                        <button
                          type="button"
                          title={t('devices.deviceMenu')}
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setContextMenuPos({ x: rect.left, y: rect.bottom + 4 });
                            setContextMenuDevice(device);
                          }}
                          className={`w-5 h-5 rounded-[4px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${
                            isSelected
                              ? 'hover:bg-white/20 text-white'
                              : 'hover:bg-[#3A3A3C] text-[#8E8E93] hover:text-white'
                          }`}
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    </div>
                  );
                })
              )}
            </nav>

            {/* Add Device Link Button */}
            <button
              onClick={handleOpenPairing}
              className="mt-2.5 px-2 py-1 text-[12px] text-[#8E8E93] hover:text-[#007AFF] transition-colors flex items-center gap-1.5 cursor-pointer truncate"
            >
              {t('devices.addDevice')}
            </button>
          </div>

          {/* Bottom Section: Destination Folder */}
          <div className="border-t border-[#2C2C2E] pt-2.5 mt-auto">
            <div className="px-1 mb-1.5 text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider truncate">
              {t('folder.destinationFolder')}
            </div>
            <div className="flex items-center justify-between gap-1.5 px-1">
              <div
                onClick={handleOpenFolder}
                className="flex items-center gap-1.5 min-w-0 cursor-pointer group"
                title={t('folder.openFolder')}
              >
                {/* Native macOS Folder Glyph */}
                <svg className="w-3.5 h-3.5 text-[#007AFF] shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.5 21a3 3 0 0 0 3-3v-8a3 3 0 0 0-3-3h-7.66l-1.8-2.4A2.25 2.25 0 0 0 8.24 3.5H4.5A3 3 0 0 0 1.5 6.5v11.5a3 3 0 0 0 3 3h15z"></path>
                </svg>
                <span className="text-[11px] text-[#D1D1D6] group-hover:text-white font-mono truncate" title={config.targetFolder}>
                  {config.targetFolder ? config.targetFolder.split(/[\\/]/).pop() || config.targetFolder : 'MacDrop'}
                </span>
              </div>
              <button
                onClick={handleSelectFolder}
                className="shrink-0 px-[7px] py-[2px] text-[11px] font-medium bg-[#2C2C2E] hover:bg-[#38383A] text-[#D1D1D6] hover:text-white border border-[#3A3A3C] rounded-[4px] shadow-[0_0.5px_1px_rgba(0,0,0,0.4)] transition-colors cursor-pointer"
              >
                {t('folder.change')}
              </button>
            </div>
          </div>
        </aside>

        {/* Resizer Splitter Divider */}
        <div
          onMouseDown={startResizing}
          className={`w-[4px] -ml-[2px] relative z-20 cursor-col-resize hover:bg-[#007AFF]/60 active:bg-[#007AFF] transition-colors select-none group flex items-center justify-center ${
            isResizing ? 'bg-[#007AFF]' : 'bg-transparent'
          }`}
          title="Изменить ширину боковой панели"
        >
          <div className="w-[1px] h-full bg-white/[0.08] pointer-events-none group-hover:bg-[#007AFF]" />
        </div>

        {/* ================= RIGHT MAIN AREA ================= */}
        <main className="flex-1 bg-transparent flex flex-col min-w-0 overflow-hidden select-none p-[14px_16px] gap-2.5">
          {/* Main Drop Zone Module (Stretches down to fill available space) */}
          <div className="flex-1 min-h-0 flex flex-col">
            <NativeDropZone
              devices={devices}
              targetDevice={targetDevice}
              onFilesDropped={handleFilesDropped}
              onChooseFiles={handleChooseFiles}
              onChooseFolder={handleChooseFolder}
              onHoveredTargetChange={setDropHoveredDeviceId}
              className="h-full"
              headerRight={
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenFolder()}
                    className="text-[11px] text-[#8E8E93] hover:text-[#007AFF] flex items-center gap-1 transition-colors cursor-pointer"
                    title={t('transfers.showInFinder')}
                  >
                    <Folder className="w-3.5 h-3.5" />
                    <span>{t('transfers.showInFinder')}</span>
                  </button>
                  {!isMac && (
                    <button
                      type="button"
                      data-no-drag
                      onClick={() => handleOpenSettings('general')}
                      className="w-5 h-5 flex items-center justify-center rounded text-[#8E8E93] hover:text-[#FFFFFF] hover:bg-[#2C2C2E] transition-colors cursor-pointer ml-1"
                      title={t('window.settings')}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                      </svg>
                    </button>
                  )}
                </div>
              }
            />
          </div>

          {/* Active Transfer Process Tile (appears at the bottom of the drop zone when transferring) */}
          {currentProgress && (
            <div className="shrink-0 p-3 bg-[#1C1C1E]/95 border border-white/[0.12] rounded-[10px] shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between gap-3">
                {/* Left: Direction icon + File metadata */}
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div className={`w-8 h-8 rounded-[8px] border flex items-center justify-center shrink-0 ${
                    currentProgress.direction === 'incoming'
                      ? 'bg-[#1C3524] border-[#2A5235] text-[#34C759]'
                      : 'bg-[#202838] border-[#2D3850] text-[#007AFF]'
                  }`}>
                    {currentProgress.direction === 'incoming' ? (
                      <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                        <line x1="12" y1="4" x2="12" y2="16"></line>
                        <polyline points="7 11 12 16 17 11"></polyline>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                        <line x1="12" y1="16" x2="12" y2="4"></line>
                        <polyline points="7 9 12 4 17 9"></polyline>
                      </svg>
                    )}
                  </div>

                  <div className="truncate">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-[12px] font-semibold text-[#F2F2F7] leading-tight truncate">
                        {currentProgress.filename}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                        currentProgress.direction === 'incoming'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      }`}>
                        {currentProgress.direction === 'incoming' ? 'Получение' : 'Отправка'}
                      </span>
                      {currentProgress.peerName && (
                        <span className="text-[10px] text-[#8E8E93] truncate">
                          • {currentProgress.peerName}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#8E8E93] leading-tight font-mono mt-0.5">
                      {formatBytes(currentProgress.bytesTransferred)} из {formatBytes(currentProgress.totalBytes)} • {formatBytes(currentProgress.speedBps)}/s {getEtaString() && `• ${getEtaString()}`}
                    </div>
                  </div>
                </div>

                {/* Right: Progress bar & Cancel button */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-[140px] h-1.5 bg-[#2C2C2E] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-150 ${
                        currentProgress.direction === 'incoming' ? 'bg-[#34C759]' : 'bg-[#007AFF]'
                      }`}
                      style={{ width: `${currentProgress.percent}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-[#F2F2F7] font-mono w-9 text-right font-semibold">
                    {Math.round(currentProgress.percent)}%
                  </span>
                  {currentProgress.direction === 'outgoing' && (
                    <button
                      onClick={() => window.macdrop?.cancelTransfer?.()}
                      className="w-5 h-5 rounded-full bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#8E8E93] hover:text-[#F2F2F7] flex items-center justify-center transition-colors cursor-pointer"
                      title={t('transfers.cancel')}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Device Context Menu */}
      {contextMenuDevice && contextMenuPos && (
        <DeviceContextMenu
          device={contextMenuDevice}
          position={contextMenuPos}
          onClose={() => {
            setContextMenuDevice(null);
            setContextMenuPos(null);
          }}
          onOpenHistory={(dev) => setHistoryModalDevice(dev)}
          onOpenRename={(dev) => setRenameModalDevice(dev)}
          onToggleReceive={(dev) => handleToggleReceive(dev)}
          onOpenUnpair={(dev) => setUnpairModalDevice(dev)}
        />
      )}

      {/* Device History Modal */}
      <DeviceHistoryModal
        isOpen={Boolean(historyModalDevice)}
        device={historyModalDevice}
        onClose={() => setHistoryModalDevice(null)}
      />

      {/* Device Rename Modal */}
      <DeviceRenameModal
        isOpen={Boolean(renameModalDevice)}
        device={renameModalDevice}
        onClose={() => setRenameModalDevice(null)}
        onSave={handleSaveRename}
      />

      {/* Device Unpair Confirmation Modal */}
      <DeviceUnpairModal
        isOpen={Boolean(unpairModalDevice)}
        device={unpairModalDevice}
        onClose={() => setUnpairModalDevice(null)}
        onConfirm={handleConfirmUnpair}
      />
    </div>
  );
}
