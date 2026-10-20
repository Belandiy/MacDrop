import React, { useRef } from 'react';
import { PairedDevice } from './DeviceDetailView';
import { useStableDropZone } from '../hooks/useStableDropZone';
import { useTranslation } from '../i18n';

interface NativeDropZoneProps {
  devices: PairedDevice[];
  targetDevice?: PairedDevice;
  onFilesDropped: (filePaths: string[], targetDeviceId?: string) => Promise<any> | void;
  onChooseFiles: (targetDeviceId?: string) => void;
  onChooseFolder?: (targetDeviceId?: string) => void;
  className?: string;
  onHoveredTargetChange?: (targetDeviceId: string | null) => void;
  headerRight?: React.ReactNode;
}

export const NativeDropZone: React.FC<NativeDropZoneProps> = ({
  devices,
  targetDevice,
  onFilesDropped,
  onChooseFiles,
  onChooseFolder,
  className = '',
  onHoveredTargetChange,
  headerRight
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Fallback target if none selected
  const activeTarget = targetDevice || devices[0];

  const {
    isDragging,
    isOverZone,
    hoveredTargetId,
    draggedFileName,
    registerTarget
  } = useStableDropZone({
    zoneRef: containerRef,
    onDropFiles: onFilesDropped,
    hysteresisBuffer: 8,
    debounceMs: 100,
    onHoveredTargetChange
  });

  const isTargetRemote = activeTarget?.connectionMode === 'remote';

  // Device helper functions
  const isMacDevice = (d: PairedDevice) =>
    d.id.startsWith('MAC') || (d.originalName || '').toLowerCase().includes('mac');
  const isMobileDevice = (d: PairedDevice) => d.id === 'mobile-web';

  const getDeviceSubtitle = (d: PairedDevice) => {
    if (d.connectionMode === 'remote') {
      return `${d.remoteIp || d.ip || 'Remote'} • P2P`;
    }
    if (d.connectionMode === 'offline') {
      return t('devices.offline');
    }
    return `${d.ip || '192.168.1.x'} • 0.8ms`;
  };

  return (
    <div className={`w-full flex flex-col justify-center select-none ${className}`}>
      {/* 
        Sending To Bar:
        Fixed min-h-[20px] ensures zero layout jump when dragging begins
      */}
      <div className="flex items-center justify-between text-[13px] text-[#E5E5EA] min-h-[20px] mb-1">
        {!isDragging ? (
          <div className="flex items-center gap-2">
            <span>
              {t('dropzone.sendingTo')}{' '}
              <span className="font-medium text-[#F2F2F7]">
                {activeTarget ? (activeTarget.customName || activeTarget.originalName) : t('dropzone.noNodeSelected')}
              </span>
            </span>
            {activeTarget && (
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isTargetRemote ? 'bg-[#007AFF]' : 'bg-[#34C759]'
                }`}
              />
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[#007AFF] font-medium animate-in fade-in duration-100">
            <svg
              className="w-3.5 h-3.5 pointer-events-none"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M12 3v12M7 10l5 5 5-5M20 21H4" />
            </svg>
            <span>{isOverZone ? t('dropzone.releaseToSendToTarget') : t('dropzone.hoverOverDestination')}</span>
          </div>
        )}

        {!isDragging && headerRight}
      </div>

      {/* 
        Fixed 120px Drop Box Target:
        Both Layer 1 (Idle) and Layer 2 (Multi-target) remain mounted for Chromium drag stability
      */}
      <div
        ref={containerRef}
        className={`h-[120px] mt-1 rounded-[6px] relative select-none overflow-hidden transition-colors duration-150 ${
          isOverZone
            ? 'border-[1.5px] border-[#007AFF] bg-[#007AFF]/15 shadow-[0_0_16px_rgba(0,122,255,0.2)]'
            : isDragging
            ? 'border border-[#007AFF]/60 bg-white/[0.06]'
            : 'border border-dashed border-white/15 hover:border-white/30 bg-white/[0.03]'
        }`}
      >
        {/* ==================== LAYER 1: IDLE / RESTING ==================== */}
        <div
          onClick={() => onChooseFiles(activeTarget?.id)}
          className={`absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-1 transition-opacity duration-150 cursor-pointer group ${
            isDragging ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
          }`}
        >
          {/* Upload tray icon */}
          <svg
            className="w-[18px] h-[18px] text-[#8E8E93] group-hover:text-[#E5E5EA] transition-colors pointer-events-none"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"></path>
            <polyline points="7 9 12 4 17 9"></polyline>
            <line x1="12" x2="12" y1="4" y2="16"></line>
          </svg>

          {/* Primary Text */}
          <span className="text-[13px] font-medium text-[#E5E5EA] pointer-events-none">
            {t('dropzone.dropFilesHereToSend')}
          </span>

          {/* Secondary Hint */}
          <span className="text-[11px] text-[#8E8E93] pointer-events-none">
            {t('dropzone.orClickToSelectFiles')}
          </span>

          {/* Action Button: Unified picker for files & folders */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChooseFiles(activeTarget?.id);
            }}
            className="mt-1 px-3.5 py-1 text-[12px] font-medium bg-[#2C2C2E] hover:bg-[#38383A] text-[#F2F2F7] border border-[#3A3A3C] rounded-[5px] shadow-[0_0.5px_1px_rgba(0,0,0,0.4)] transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5 text-[#007AFF]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span>{t('dropzone.chooseFilesBtn')}</span>
          </button>
        </div>

        {/* ==================== LAYER 2: DRAG-OVER MULTI-TARGET ==================== */}
        <div
          className={`absolute inset-0 w-full h-full p-2 flex gap-2 transition-opacity duration-150 bg-black/40 ${
            isDragging ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          {devices.length === 0 ? (
            /* Fallback if no paired devices */
            <div className="flex-1 h-full rounded-[6px] bg-[#202022] border border-[#333333] p-2 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-[12px] font-medium text-[#F2F2F7]">{t('devices.noDevices')}</span>
              <span className="text-[10px] text-[#8E8E93]">{t('devices.noDevicesDesc')}</span>
            </div>
          ) : (
            devices.slice(0, 3).map((device) => {
              const isHovered = hoveredTargetId === device.id;
              const isMac = isMacDevice(device);
              const isMobile = isMobileDevice(device);
              const isRemote = device.connectionMode === 'remote';

              return (
                <div
                  key={device.id}
                  data-device-id={device.id}
                  ref={(el) => registerTarget(device.id, el)}
                  className={`flex-1 h-full rounded-[6px] p-2.5 flex flex-col justify-between relative overflow-hidden transition-all duration-100 ${
                    isHovered
                      ? 'bg-[rgba(0,122,255,0.12)] border-[1.5px] border-[#007AFF] shadow-[inset_0_0_12px_rgba(0,122,255,0.1)]'
                      : 'bg-[#202022] border border-[#333333]'
                  }`}
                >
                  {/* Top row: Device Name & Type */}
                  <div className="flex items-center justify-between pointer-events-none">
                    <div className="flex items-center gap-1.5 truncate">
                      {isMobile ? (
                        <svg className={`w-3.5 h-3.5 ${isHovered ? 'text-white' : 'text-[#8E8E93]'}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                          <rect x="5" y="2" width="14" height="20" rx="2" />
                          <line x1="12" y1="18" x2="12.01" y2="18" />
                        </svg>
                      ) : isMac ? (
                        <svg className={`w-3.5 h-3.5 ${isHovered ? 'text-white' : 'text-[#8E8E93]'}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                          <rect x="3" y="4" width="18" height="12" rx="2" />
                          <line x1="2" y1="20" x2="22" y2="20" />
                        </svg>
                      ) : (
                        <svg className={`w-3.5 h-3.5 ${isHovered ? 'text-white' : 'text-[#8E8E93]'}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                          <rect x="2" y="3" width="20" height="14" rx="2" />
                          <line x1="8" y1="21" x2="16" y2="21" />
                          <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                      )}
                      <span className={`text-[12px] font-medium truncate ${isHovered ? 'text-white font-semibold' : 'text-[#F2F2F7]'}`}>
                        {device.customName || device.originalName}
                      </span>
                    </div>

                    <div className={`flex items-center gap-1 px-1.5 py-0.2 rounded border text-[9px] shrink-0 ${
                      isHovered
                        ? 'bg-[rgba(0,122,255,0.2)] border-[#007AFF]/40 text-[#007AFF]'
                        : 'bg-[#18181A] border-[#2A2A2D] text-[#8E8E93]'
                    }`}>
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isRemote ? 'bg-[#007AFF]' : 'bg-[#34C759]'
                        }`}
                      />
                      <span>{isRemote ? 'P2P' : 'LAN'}</span>
                    </div>
                  </div>

                  {/* Center Action Hint */}
                  <div className="flex flex-col items-center justify-center my-auto pointer-events-none">
                    <span className={`text-[11px] leading-tight text-center ${
                      isHovered ? 'text-[#007AFF] font-bold' : 'text-[#8E8E93]'
                    }`}>
                      {isHovered ? t('dropzone.releaseToSend') : t('dropzone.dropToSend')}
                    </span>
                    <span className="text-[9px] text-[#636366] font-mono mt-0.5">
                      {getDeviceSubtitle(device)}
                    </span>
                  </div>

                  {/* Dragged item pill */}
                  {isHovered && draggedFileName && (
                    <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-[#2C2C2E] border border-[#3A3A3C] text-[9px] text-[#F2F2F7] flex items-center gap-1 shadow-sm pointer-events-none truncate max-w-[110px]">
                      <span className="truncate">{draggedFileName}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
