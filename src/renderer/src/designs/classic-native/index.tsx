import React, { useState } from 'react';
import {
  X,
  Check,
  Search,
} from 'lucide-react';
import { DesignProps } from '../types';
import { NativeDropZone } from '../../components/NativeDropZone';
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
    handleChooseFiles
  } = props;

  const { t } = useTranslation();

  // Filter state for transfers: All | Active | Completed
  const [transferFilter, setTransferFilter] = useState<'all' | 'active' | 'completed'>('all');

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
  const recentHistory = status.recentHistory || [];

  const timeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return t('history.justNow');
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t('history.minAgo', { min: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('history.hrAgo', { hr: hours });
    return new Date(timestamp).toLocaleDateString();
  };

  // Calculate ETA for active transfer
  const getEtaString = () => {
    if (!currentProgress || !currentProgress.bytesPerSecond || currentProgress.bytesPerSecond === 0) {
      return '';
    }
    const remainingBytes = (currentProgress.total || 0) - (currentProgress.transferred || 0);
    if (remainingBytes <= 0) return t('transfers.finishing');
    const seconds = Math.ceil(remainingBytes / currentProgress.bytesPerSecond);
    if (seconds < 60) return t('transfers.secLeft', { sec: seconds });
    return t('transfers.minLeft', { min: Math.ceil(seconds / 60) });
  };

  const hasActiveTransfer = Boolean(currentProgress);
  const showActiveRow = hasActiveTransfer && (transferFilter === 'all' || transferFilter === 'active');
  const showCompletedRows = transferFilter === 'all' || transferFilter === 'completed';

  return (
    <div className="w-full h-full bg-[#161616] text-[#F2F2F7] flex flex-col overflow-hidden select-none font-sans antialiased">
      {/* ========================================================
          UNIFIED macOS TOOLBAR / TITLEBAR (38px)
          ======================================================== */}
      <header
        style={{ WebkitAppRegion: 'drag' } as any}
        className="h-[38px] px-3 bg-[#232326] border-b border-[#2C2C2E] flex items-center justify-between shrink-0 relative select-none"
      >
        {/* Genuine macOS Traffic Lights */}
        <div style={{ WebkitAppRegion: 'no-drag' } as any} className="flex items-center gap-[7px]">
          <button
            onClick={() => window.macdrop?.closeWindow()}
            title={t('window.close')}
            className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]/60 flex items-center justify-center cursor-pointer transition-transform active:scale-95"
          />
          <button
            onClick={() => window.macdrop?.minimizeWindow()}
            title={t('window.minimize')}
            className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]/60 flex items-center justify-center cursor-pointer transition-transform active:scale-95"
          />
          <button
            onClick={() => window.macdrop?.maximizeWindow?.()}
            title={t('window.zoom')}
            className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]/60 flex items-center justify-center cursor-pointer transition-transform active:scale-95"
          />
        </div>

        {/* Centered Window Title */}
        <div className="absolute inset-x-0 flex items-center justify-center pointer-events-none">
          <span className="text-[13px] font-medium text-[#F2F2F7] tracking-tight">MacDrop</span>
        </div>

        {/* Settings Icon Button (Right) */}
        <button
          style={{ WebkitAppRegion: 'no-drag' } as any}
          onClick={() => handleOpenSettings('general')}
          className="w-6 h-6 flex items-center justify-center rounded text-[#8E8E93] hover:text-[#FFFFFF] hover:bg-[#2C2C2E] transition-colors cursor-pointer"
          title={t('window.settings')}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </header>

      {/* ========================================================
          SPLIT-VIEW CONTAINER
          ======================================================== */}
      <div className="flex-1 flex overflow-hidden">
        {/* ================= LEFT SIDEBAR (220px) ================= */}
        <aside className="w-[220px] bg-[#1E1E1E] border-r border-[#2C2C2E] p-[12px_10px] flex flex-col justify-between shrink-0 select-none">
          {/* Top Section: Devices */}
          <div>
            <div className="px-2 py-1 text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
              {t('devices.title')}
            </div>
            <nav className="mt-1 space-y-0.5">
              {devices.length === 0 ? (
                <div className="px-2 py-2 text-[12px] text-[#8E8E93]">
                  {t('devices.noDevices')}
                </div>
              ) : (
                devices.map((device) => {
                  const isSelected = targetDevice && targetDevice.id === device.id;
                  const isRemote = device.connectionMode === 'remote';
                  const isOffline = device.connectionMode === 'offline';

                  return (
                    <button
                      key={device.id}
                      onClick={() => setActiveTargetDeviceAndSave(device.id)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'copy';
                      }}
                      onDrop={(e) => handleFileDropOnTarget(e, device.id)}
                      className={`w-full h-7 px-2 rounded-[6px] flex items-center justify-between text-[13px] font-normal transition-colors text-left cursor-pointer ${
                        isSelected
                          ? 'bg-[#007AFF] text-white shadow-sm'
                          : 'text-[#E5E5EA] hover:bg-[#282828]'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
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
                        <span className="truncate">{device.customName || device.originalName}</span>
                      </span>
                      <span
                        className={`text-[10px] font-medium shrink-0 ml-1.5 ${
                          isSelected ? 'text-white/80' : 'text-[#8E8E93]'
                        }`}
                      >
                        {isRemote ? 'P2P' : isOffline ? '' : 'LAN'}
                      </span>
                    </button>
                  );
                })
              )}
            </nav>

            {/* Add Device Link Button */}
            <button
              onClick={handleOpenPairing}
              className="mt-2.5 px-2 py-1 text-[12px] text-[#8E8E93] hover:text-[#007AFF] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {t('devices.addDevice')}
            </button>
          </div>

          {/* Bottom Section: Destination Folder */}
          <div className="border-t border-[#2C2C2E] pt-2.5 mt-auto">
            <div className="px-1 mb-1.5 text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider">
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
                <span className="text-[11px] text-[#D1D1D6] group-hover:text-white font-mono truncate max-w-[110px]" title={config.targetFolder}>
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

        {/* ================= RIGHT MAIN AREA (540px) ================= */}
        <main className="w-[540px] bg-[#161616] flex flex-col flex-1 overflow-hidden select-none">
          {/* Top Section: Send / Drop Area (180px) */}
          <section className="h-[180px] p-4 border-b border-[#2C2C2E] flex flex-col box-border justify-center">
            <NativeDropZone
              devices={devices}
              targetDevice={targetDevice}
              onFilesDropped={handleFilesDropped}
              onChooseFiles={handleChooseFiles}
            />
          </section>

          {/* Bottom Section: Transfers & Activity (Remaining Height) */}
          <section className="flex-1 p-[14px_16px] flex flex-col overflow-hidden">
            {/* Section Header Row */}
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[13px] font-semibold text-[#F2F2F7]">{t('transfers.title')}</span>

              {/* macOS Segmented Control */}
              <div className="inline-flex p-0.5 rounded-[6px] bg-[#252528] border border-[#333336] text-[11px]">
                <button
                  onClick={() => setTransferFilter('all')}
                  className={`px-2.5 py-0.5 rounded-[4px] font-medium transition-all cursor-pointer ${
                    transferFilter === 'all'
                      ? 'bg-[#3A3A3E] text-white shadow-sm'
                      : 'text-[#8E8E93] hover:text-[#E5E5EA]'
                  }`}
                >
                  {t('transfers.all')}
                </button>
                <button
                  onClick={() => setTransferFilter('active')}
                  className={`px-2.5 py-0.5 rounded-[4px] font-medium transition-all cursor-pointer ${
                    transferFilter === 'active'
                      ? 'bg-[#3A3A3E] text-white shadow-sm'
                      : 'text-[#8E8E93] hover:text-[#E5E5EA]'
                  }`}
                >
                  {t('transfers.active')}
                </button>
                <button
                  onClick={() => setTransferFilter('completed')}
                  className={`px-2.5 py-0.5 rounded-[4px] font-medium transition-all cursor-pointer ${
                    transferFilter === 'completed'
                      ? 'bg-[#3A3A3E] text-white shadow-sm'
                      : 'text-[#8E8E93] hover:text-[#E5E5EA]'
                  }`}
                >
                  {t('transfers.completed')}
                </button>
              </div>
            </div>

            {/* Clean Tabular Transfer List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#242426]">
              {/* Row 1: Active Transfer (if present) */}
              {showActiveRow && currentProgress && (
                <div className="h-11 flex items-center justify-between py-1">
                  {/* Left: File Metadata */}
                  <div className="flex items-center gap-2.5 min-w-0 pr-3">
                    {/* Archive File Icon */}
                    <div className="w-6 h-6 rounded bg-[#202838] border border-[#2D3850] flex items-center justify-center shrink-0 text-[#007AFF]">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
                        <rect height="18" rx="2" width="18" x="3" y="4"></rect>
                        <line x1="12" x2="12" y1="4" y2="10"></line>
                        <line x1="10" x2="14" y1="7" y2="7"></line>
                      </svg>
                    </div>
                    <div className="truncate">
                      <div className="text-[12px] font-medium text-[#F2F2F7] leading-tight truncate">
                        {currentProgress.filename}
                      </div>
                      <div className="text-[11px] text-[#8E8E93] leading-tight font-mono">
                        {formatBytes(currentProgress.bytesPerSecond || 0)}/s {getEtaString() && `• ${getEtaString()}`}
                      </div>
                    </div>
                  </div>

                  {/* Center: Native Linear Progress Bar */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-[140px] h-1 bg-[#2C2C2E] rounded-[2px] overflow-hidden">
                      <div
                        className="h-full bg-[#007AFF] rounded-[2px] transition-all duration-100"
                        style={{ width: `${currentProgress.percent || 0}%` }}
                      ></div>
                    </div>
                    {/* Right: Status Readout & Cancel Button */}
                    <span className="text-[11px] text-[#8E8E93] font-mono w-7 text-right">
                      {Math.round(currentProgress.percent || 0)}%
                    </span>
                    <button
                      onClick={() => window.macdrop?.cancelTransfer?.()}
                      className="w-4 h-4 rounded-full bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[#8E8E93] hover:text-[#F2F2F7] flex items-center justify-center transition-colors cursor-pointer"
                      title={t('transfers.cancel')}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Row 2+: Completed Transfers */}
              {showCompletedRows && recentHistory.length > 0 ? (
                recentHistory.map((item: any) => (
                  <div
                    key={item.id}
                    onClick={() => handleOpenFolder()}
                    className="h-11 flex items-center justify-between py-1 hover:bg-[#1A1A1A] px-1 rounded transition-colors cursor-pointer group"
                  >
                    {/* Left: File Metadata */}
                    <div className="flex items-center gap-2.5 min-w-0 pr-3">
                      {/* Image/File Icon */}
                      <div className="w-6 h-6 rounded bg-[#20252D] border border-[#2D343F] flex items-center justify-center shrink-0 text-[#8E8E93]">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
                          <rect height="18" rx="2" ry="2" width="18" x="3" y="3"></rect>
                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                          <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                      </div>
                      <div className="truncate">
                        <div className="text-[12px] font-medium text-[#F2F2F7] leading-tight truncate group-hover:text-[#007AFF] transition-colors">
                          {item.filename}
                        </div>
                        <div className="text-[11px] text-[#8E8E93] leading-tight font-mono">
                          {formatBytes(item.size)} • {timeAgo(item.timestamp)}
                        </div>
                      </div>
                    </div>

                    {/* Center & Right: Completed Status Badge + Action Button */}
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="flex items-center gap-1 text-[11px] text-[#34C759] font-medium">
                        <Check className="w-3.5 h-3.5 stroke-[2]" />
                        <span>{t('transfers.completed')}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenFolder();
                        }}
                        className="text-[11px] text-[#8E8E93] hover:text-[#007AFF] flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>{t('transfers.showInFinder')}</span>
                      </button>
                    </div>
                  </div>
                ))
              ) : null}

              {/* Empty state if nothing to show */}
              {!hasActiveTransfer && (!showCompletedRows || recentHistory.length === 0) && (
                <div className="h-full flex items-center justify-center text-[#8E8E93] text-[12px] py-8">
                  {t('transfers.noTransfers')}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
