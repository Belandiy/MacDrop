import React, { useRef } from 'react';
import { PairedDevice } from './DeviceDetailView';
import { useStableDropZone } from '../hooks/useStableDropZone';

interface NativeDropZoneProps {
  devices: PairedDevice[];
  targetDevice?: PairedDevice;
  onFilesDropped: (filePaths: string[], targetDeviceId?: string) => Promise<any> | void;
  onChooseFiles: (targetDeviceId?: string) => void;
  className?: string;
}

export const NativeDropZone: React.FC<NativeDropZoneProps> = ({
  devices,
  targetDevice,
  onFilesDropped,
  onChooseFiles,
  className = ''
}) => {
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
    debounceMs: 100
  });

  const isTargetRemote = activeTarget?.connectionMode === 'remote';

  // Device helper functions
  const isMacDevice = (d: PairedDevice) =>
    d.id.startsWith('MAC') || (d.originalName || '').toLowerCase().includes('mac');
  const isMobileDevice = (d: PairedDevice) => d.id === 'mobile-web';

  const getDeviceSubtitle = (d: PairedDevice) => {
    if (d.connectionMode === 'remote') {
      return `${d.remoteIp || d.ip || 'Remote'} • Direct Tunnel`;
    }
    if (d.connectionMode === 'offline') {
      return 'Офлайн';
    }
    return `${d.ip || '192.168.1.x'} • LAN 0.8ms`;
  };

  return (
    <div className={`w-full flex flex-col items-center select-none ${className}`}>
      {/* 
        Target Sending Bar Context:
        Fixed min-h-[22px] prevents layout shifts when swapping text during dragover
      */}
      <div className="w-full max-w-[520px] min-h-[22px] mb-2 flex items-center justify-between text-[11px] font-sans">
        {!isDragging ? (
          /* State 1: Resting context */
          <>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span>Получатель:</span>
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                {activeTarget ? (activeTarget.customName || activeTarget.originalName) : 'Не выбрано'}
                {activeTarget && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isTargetRemote
                        ? 'bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.6)]'
                        : 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]'
                    }`}
                  />
                )}
              </span>
            </div>
            <span className="text-[10px] text-slate-500">Готов к передаче</span>
          </>
        ) : (
          /* State 2: Dragging context */
          <>
            <div className="flex items-center gap-1.5 text-indigo-400 font-semibold animate-in fade-in duration-150">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pointer-events-none"
              >
                <path d="M12 3v12M7 10l5 5 5-5M20 21H4" />
              </svg>
              <span>{isOverZone ? 'Отпустите файл над плиткой' : 'Перетащите файл в зону...'}</span>
            </div>
            <span className="text-[10px] text-slate-400">
              {isOverZone ? 'Зона активна' : 'Наведите на плитку'}
            </span>
          </>
        )}
      </div>

      {/* 
        The 520x190 Fixed Component (Zero Layout Jitter):
        Both layers remain permanently in the DOM to avoid Chromium DOM-mutation drag resets.
      */}
      <div
        ref={containerRef}
        className={`w-full max-w-[520px] h-[190px] rounded-xl relative select-none overflow-hidden transition-all duration-200 ${
          isOverZone
            ? 'border border-indigo-500/80 shadow-[0_0_30px_rgba(99,102,241,0.2)]'
            : isDragging
            ? 'border border-indigo-500/40 shadow-[0_0_20px_rgba(99,102,241,0.1)]'
            : 'border border-dashed border-white/[0.08] hover:border-indigo-500/40'
        }`}
      >
        {/* ==================== LAYER 1: IDLE / RESTING ==================== */}
        <div
          className={`absolute inset-0 w-full h-full bg-[#171923]/70 hover:bg-[#171923]/95 flex flex-col items-center justify-center px-6 transition-all duration-150 backdrop-blur-md ${
            isDragging ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
          }`}
        >
          {/* Tray icon */}
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-400 mb-2.5 shadow-sm pointer-events-none">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3v11M8 10l4 4 4-4" />
              <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
            </svg>
          </div>

          {/* Primary text */}
          <div className="text-[13px] font-semibold text-slate-200 leading-tight mb-1 pointer-events-none">
            Перетащите файлы для отправки
          </div>

          {/* Secondary hint */}
          <div className="text-[11px] text-slate-400 mb-3 text-center pointer-events-none">
            Получатель:{' '}
            <span className="text-indigo-400 font-semibold">
              {activeTarget ? (activeTarget.customName || activeTarget.originalName) : 'Не выбран'}
            </span>{' '}
            • или нажмите для выбора файлов
          </div>

          {/* Native button */}
          <button
            type="button"
            onClick={() => onChooseFiles(activeTarget?.id)}
            className="h-[28px] px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-[11px] text-white font-medium shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <span>Выбрать файлы...</span>
          </button>
        </div>

        {/* ==================== LAYER 2: DRAG-OVER MULTI-TARGET ==================== */}
        <div
          className={`absolute inset-0 w-full h-full bg-[#141620]/95 p-2.5 flex gap-2.5 transition-all duration-150 ${
            isDragging ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          {devices.length === 0 ? (
            /* Fallback if no paired devices */
            <div className="flex-1 h-full rounded-lg bg-white/[0.03] border border-white/[0.08] p-3.5 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-[13px] font-medium text-slate-200 mb-1">Нет сопряженных устройств</span>
              <span className="text-[11px] text-slate-400">Сначала подключите устройство через код или QR</span>
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
                  ref={(el) => registerTarget(device.id, el)}
                  className={`flex-1 h-full rounded-lg p-3.5 flex flex-col justify-between relative overflow-hidden transition-all duration-150 ${
                    isHovered
                      ? 'bg-indigo-950/40 border-[1.5px] border-indigo-400 ring-2 ring-indigo-500/30 shadow-[inset_0_0_16px_rgba(99,102,241,0.2)]'
                      : 'bg-[#181a26]/70 border border-white/[0.06]'
                  }`}
                >
                  {/* All children use pointer-events-none to eliminate bubbling flutter */}
                  <div className="flex items-center justify-between pointer-events-none">
                    <div className="flex items-center gap-2 truncate">
                      <div className={`p-1 rounded transition-colors ${isHovered ? 'bg-indigo-500/30 text-white' : 'bg-white/[0.05] text-slate-400'}`}>
                        {isMobile ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="5" y="2" width="14" height="20" rx="2" />
                            <line x1="12" y1="18" x2="12.01" y2="18" />
                          </svg>
                        ) : isMac ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="12" rx="2" />
                            <line x1="2" y1="20" x2="22" y2="20" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="3" width="20" height="14" rx="2" />
                            <line x1="8" y1="21" x2="16" y2="21" />
                            <line x1="12" y1="17" x2="12" y2="21" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-[12px] font-semibold truncate transition-colors ${isHovered ? 'text-white' : 'text-slate-200'}`}>
                        {device.customName || device.originalName}
                      </span>
                    </div>

                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border shrink-0 transition-colors ${
                      isHovered
                        ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200'
                        : 'bg-white/[0.04] border-white/[0.06] text-slate-400'
                    }`}>
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isRemote ? 'bg-cyan-400 shadow-[0_0_6px_#06b6d4]' : 'bg-emerald-400 shadow-[0_0_6px_#10b981]'
                        }`}
                      />
                      <span className="text-[9px] font-medium">
                        {isRemote ? 'Интернет' : 'Wi-Fi'}
                      </span>
                    </div>
                  </div>

                  {/* Center hint callout */}
                  <div className="flex flex-col items-center justify-center my-auto py-1 pointer-events-none">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white mb-1.5 transition-all ${
                      isHovered
                        ? 'bg-indigo-600 shadow-md shadow-indigo-600/40 scale-105'
                        : 'bg-white/[0.05] text-slate-500'
                    }`}>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.25"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 4v13M6 11l6 6 6-6" />
                      </svg>
                    </div>
                    <span className={`text-[12px] font-bold tracking-tight text-center leading-tight transition-colors ${
                      isHovered ? 'text-indigo-300' : 'text-slate-400 font-medium'
                    }`}>
                      {isHovered ? 'Отпустить для отправки' : 'Бросить сюда'}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 font-medium truncate max-w-[140px]">
                      {isHovered ? (device.customName || device.originalName) : (isRemote ? 'P2P туннель' : 'Локальная сеть')}
                    </span>
                  </div>

                  {/* Sub-footer info */}
                  <div className={`text-[9px] text-center font-mono pointer-events-none transition-colors ${
                    isHovered ? 'text-indigo-300/80' : 'text-slate-500'
                  }`}>
                    {getDeviceSubtitle(device)}
                  </div>

                  {/* Dragged item badge preview */}
                  {isHovered && draggedFileName && (
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-[#161824] border border-indigo-500/40 text-[10px] text-slate-200 flex items-center gap-1.5 shadow-md pointer-events-none animate-in fade-in duration-100">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span className="truncate max-w-[100px]">{draggedFileName}</span>
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
