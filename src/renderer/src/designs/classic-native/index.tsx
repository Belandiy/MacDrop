import React from 'react';
import {
  Laptop,
  Monitor,
  Smartphone,
  Folder,
  Settings,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  ExternalLink,
} from 'lucide-react';
import { DesignProps } from '../types';
import { PairedDevice } from '../../components/DeviceDetailView';
import { NativeDropZone } from '../../components/NativeDropZone';
import packageJson from '../../../../../package.json';

export const name = 'Classic Native (macOS)';
export const windowSize = { width: 760, height: 490 };

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'только что';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  return new Date(timestamp).toLocaleDateString();
}

export default function ClassicNativeDesign(props: DesignProps) {
  const {
    config,
    status,
    activeTargetDeviceId,
    setActiveTargetDeviceAndSave,
    platform,
    devices,
    handleSelectFolder,
    handleOpenFolder,
    handleFilesDropped,
    handleOpenSettings,
    handleOpenPairing,
    handleChooseFiles
  } = props;

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

  const currentProgress = status.currentProgress;

  return (
    <div className="flex flex-col h-full bg-[#14161d] text-[#e1e4ea] select-none antialiased font-sans text-xs">
      {/* Native-style macOS / Windows Titlebar */}
      <header
        style={{ WebkitAppRegion: 'drag' } as any}
        className="h-10 px-3.5 flex items-center justify-between border-b border-white/[0.06] bg-[#1a1d26] shrink-0"
      >
        {/* Left: Window Controls */}
        <div style={{ WebkitAppRegion: 'no-drag' } as any} className="flex items-center gap-2">
          {platform === 'darwin' ? (
            <div className="flex items-center gap-1.5 group">
              <button
                onClick={() => window.macdrop?.closeWindow()}
                className="w-3 h-3 rounded-full bg-[#ff5f56] hover:brightness-110 active:brightness-90 transition-all flex items-center justify-center cursor-pointer"
              />
              <button
                onClick={() => window.macdrop?.minimizeWindow()}
                className="w-3 h-3 rounded-full bg-[#ffbd2e] hover:brightness-110 active:brightness-90 transition-all flex items-center justify-center cursor-pointer"
              />
              <button
                onClick={() => window.macdrop?.maximizeWindow?.()}
                className="w-3 h-3 rounded-full bg-[#27c93f] hover:brightness-110 active:brightness-90 transition-all flex items-center justify-center cursor-pointer"
              />
            </div>
          ) : (
            <span className="font-semibold text-slate-300">MacDrop</span>
          )}
        </div>

        {/* Center: Title & Version */}
        <div className="flex items-center gap-2 pointer-events-none">
          <span className="font-bold text-[12px] text-slate-200 tracking-tight">MacDrop</span>
          <span className="font-mono text-[10px] text-slate-400 px-1 py-0.2 rounded bg-white/[0.05] border border-white/[0.06]">
            v{packageJson.version}
          </span>
        </div>

        {/* Right: Actions */}
        <div style={{ WebkitAppRegion: 'no-drag' } as any} className="flex items-center gap-1">
          <button
            onClick={() => handleOpenSettings('general')}
            title="Настройки"
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          {platform !== 'darwin' && (
            <button
              onClick={() => window.macdrop?.closeWindow()}
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Main Split-View Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: 240px */}
        <aside className="w-60 bg-[#161821] border-r border-white/[0.06] flex flex-col justify-between shrink-0">
          <div className="p-3 overflow-y-auto flex-1 space-y-4">
            {/* Devices Section */}
            <div>
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Устройства ({devices.length})
                </span>
                <button
                  onClick={handleOpenPairing}
                  title="Подключить устройство"
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1">
                {devices.length === 0 ? (
                  <div className="px-2 py-3 rounded-lg bg-white/[0.02] border border-white/[0.04] text-center">
                    <p className="text-[11px] text-slate-400 mb-2">Нет подключенных устройств</p>
                    <button
                      onClick={handleOpenPairing}
                      className="px-2.5 py-1 text-[11px] font-medium bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 rounded-md border border-indigo-500/30 transition-all"
                    >
                      + Подключить
                    </button>
                  </div>
                ) : (
                  devices.map((device) => {
                    const isSelected = (targetDevice && targetDevice.id === device.id);
                    const isMac = device.id.startsWith('MAC') || (device.originalName || '').toLowerCase().includes('mac');
                    const isMobile = device.id === 'mobile-web';

                    return (
                      <div
                        key={device.id}
                        onClick={() => setActiveTargetDeviceAndSave(device.id)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'copy';
                        }}
                        onDrop={(e) => handleFileDropOnTarget(e, device.id)}
                        className={`flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-all border ${
                          isSelected
                            ? 'bg-indigo-600/20 text-white border-indigo-500/40 shadow-sm'
                            : 'bg-white/[0.02] hover:bg-white/[0.06] text-slate-300 border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div className={`p-1.5 rounded-md ${
                            isSelected ? 'bg-indigo-500/30 text-indigo-200' : 'bg-white/[0.05] text-slate-400'
                          }`}>
                            {isMobile ? (
                              <Smartphone className="w-3.5 h-3.5" />
                            ) : isMac ? (
                              <Laptop className="w-3.5 h-3.5" />
                            ) : (
                              <Monitor className="w-3.5 h-3.5" />
                            )}
                          </div>

                          <div className="truncate">
                            <div className="text-[11px] font-medium truncate">
                              {device.customName || device.originalName}
                            </div>
                            <div className="text-[9px] text-slate-400 flex items-center gap-1 font-mono">
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  device.connectionMode === 'remote'
                                    ? 'bg-cyan-400'
                                    : device.connectionMode === 'offline'
                                    ? 'bg-slate-500'
                                    : 'bg-emerald-400'
                                }`}
                              />
                              <span>
                                {device.connectionMode === 'remote'
                                  ? 'Интернет'
                                  : device.connectionMode === 'offline'
                                  ? 'Офлайн'
                                  : 'Локальная сеть'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Storage Vault Block */}
          <div className="p-3 border-t border-white/[0.06] bg-[#14161e]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Folder className="w-3 h-3 text-amber-400" />
                Папка сохранения
              </span>
            </div>
            <div
              className="text-[10px] font-mono text-slate-300 truncate bg-black/30 px-2 py-1 rounded border border-white/[0.05] mb-2"
              title={config.targetFolder}
            >
              {config.targetFolder}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={handleSelectFolder}
                className="px-2 py-1 text-[10px] bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 rounded border border-white/[0.06] transition-all text-center"
              >
                Изменить...
              </button>
              <button
                onClick={handleOpenFolder}
                className="px-2 py-1 text-[10px] bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 rounded border border-indigo-500/30 transition-all text-center flex items-center justify-center gap-1"
              >
                <span>Открыть</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        </aside>

        {/* Right Main Content Pane */}
        <main className="flex-1 flex flex-col overflow-y-auto p-4 gap-4 bg-[#11131a]">
          {/* Active Transfer Progress Banner (if active) */}
          {currentProgress && (
            <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-3 shadow-lg animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 truncate">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  <span className="font-semibold text-white truncate text-[11px]">
                    {currentProgress.filename}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-indigo-300">
                  {Math.round(currentProgress.percent || 0)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden mb-1.5">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-150"
                  style={{ width: `${currentProgress.percent || 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>{formatBytes(currentProgress.bytesPerSecond || 0)}/с</span>
                <span>
                  {formatBytes(currentProgress.transferred || 0)} / {formatBytes(currentProgress.total || 0)}
                </span>
              </div>
            </div>
          )}

          {/* NATIVE APP-KIT / SWIFTUI DROP ZONE */}
          <NativeDropZone
            devices={devices}
            targetDevice={targetDevice}
            onFilesDropped={handleFilesDropped}
            onChooseFiles={handleChooseFiles}
          />

          {/* Transfers Activity List */}
          <div className="flex-1 flex flex-col bg-[#161821] rounded-xl border border-white/[0.06] p-3 overflow-hidden">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/[0.06]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                История передач ({status.recentHistory?.length || 0})
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {!status.recentHistory || status.recentHistory.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-[11px]">
                  Здесь будут отображаться переданные файлы
                </div>
              ) : (
                status.recentHistory.map((item: any) => (
                  <div
                    key={item.id}
                    onClick={() => handleOpenFolder()}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className={`p-1 rounded ${
                        item.direction === 'incoming'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-indigo-500/15 text-indigo-300'
                      }`}>
                        {item.direction === 'incoming' ? (
                          <ArrowDownLeft className="w-3 h-3" />
                        ) : (
                          <ArrowUpRight className="w-3 h-3" />
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-slate-200 truncate group-hover:text-indigo-300 transition-colors">
                        {item.filename}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono shrink-0">
                      <span>{formatBytes(item.size)}</span>
                      <span>•</span>
                      <span>{timeAgo(item.timestamp)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
