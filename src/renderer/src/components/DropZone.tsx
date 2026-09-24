import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { UploadCloud, FileCheck, Ban, AlertCircle, Laptop, Monitor, Radio, FileUp, ChevronDown, Check, Smartphone } from 'lucide-react';
import { PairedDevice } from './DeviceDetailView';

interface DropZoneProps {
  onFilesDropped: (filePaths: string[], targetDeviceId?: string) => Promise<any> | void;
  targetFolder?: string;
  onChooseFiles?: (targetDeviceId?: string) => void;
  devices?: PairedDevice[];
  selectedDeviceId?: string | null;
  onSelectDevice?: (deviceId: string) => void;
  onOpenPairing?: () => void;
}

interface DeviceSelectorProps {
  devices: PairedDevice[];
  targetDevice: PairedDevice;
  onSelectDevice?: (deviceId: string) => void;
  onOpenPairing?: () => void;
}

const DeviceSelector: React.FC<DeviceSelectorProps> = ({
  devices,
  targetDevice,
  onSelectDevice,
  onOpenPairing
}) => {
  const [isDeviceMenuOpen, setIsDeviceMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDeviceMenuOpen(false);
      }
    };
    if (isDeviceMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDeviceMenuOpen]);

  return (
    <div className="w-full flex items-center justify-between pb-3 border-b border-white/5 mb-3.5 relative z-30">
      <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
        Получатель:
      </span>

      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsDeviceMenuOpen((prev) => !prev);
          }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border shadow-sm ${
            isDeviceMenuOpen
              ? 'bg-[#181b26] text-white border-indigo-500/50 shadow-indigo-500/15 ring-1 ring-indigo-500/30'
              : 'bg-[#0e1017] hover:bg-white/10 text-slate-200 border-white/10 hover:border-white/20'
          }`}
        >
          {targetDevice && (
            <>
              {targetDevice.id === 'mobile-web' ? (
                <Smartphone className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              ) : targetDevice.id.toUpperCase().startsWith('MAC') ||
              (targetDevice.originalName || '').toLowerCase().includes('mac') ? (
                <Laptop className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              ) : (
                <Monitor className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              )}

              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  targetDevice.connectionMode === 'remote'
                    ? 'bg-cyan-400 shadow-sm shadow-cyan-400'
                    : 'bg-emerald-400 shadow-sm shadow-emerald-400'
                }`}
              />

              <span className="truncate max-w-[150px]">
                {targetDevice.customName || targetDevice.originalName}
              </span>
            </>
          )}

          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              isDeviceMenuOpen ? 'rotate-180 text-indigo-300' : ''
            }`}
          />
        </button>

        {isDeviceMenuOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-full mt-1.5 w-64 rounded-xl bg-[#12141d] border border-white/10 shadow-2xl shadow-black/80 backdrop-blur-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-white/5 mb-1 flex items-center justify-between">
              <span>Выберите устройство</span>
              <span className="text-slate-500 font-mono">{devices.length}</span>
            </div>

            <div className="max-h-52 overflow-y-auto space-y-0.5">
              {devices.map((d) => {
                const isSelected = d.id === targetDevice?.id;
                const isRemote = d.connectionMode === 'remote';
                const isMobile = d.id === 'mobile-web';
                const isMac =
                  d.id.toUpperCase().startsWith('MAC') ||
                  (d.originalName || '').toLowerCase().includes('mac');

                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      onSelectDevice?.(d.id);
                      setIsDeviceMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors ${
                      isSelected
                        ? 'bg-indigo-600/20 text-white border border-indigo-500/35 font-medium'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isMobile ? (
                        <Smartphone
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected ? 'text-indigo-400' : 'text-slate-400'
                          }`}
                        />
                      ) : isMac ? (
                        <Laptop
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected ? 'text-indigo-400' : 'text-slate-400'
                          }`}
                        />
                      ) : (
                        <Monitor
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected ? 'text-indigo-400' : 'text-slate-400'
                          }`}
                        />
                      )}

                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isRemote ? 'bg-cyan-400' : 'bg-emerald-400'
                        }`}
                        title={isRemote ? 'Удаленная связь' : 'Локальная сеть'}
                      />

                      <div className="flex flex-col items-start min-w-0">
                        <span className="truncate max-w-[150px] font-medium text-left">
                          {d.customName || d.originalName}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {isRemote ? 'Удаленная сеть' : 'Локальная сеть'}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 ml-1.5" />
                    )}
                  </button>
                );
              })}
            </div>

            {onOpenPairing && (
              <div className="pt-1 mt-1 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeviceMenuOpen(false);
                    onOpenPairing();
                  }}
                  className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors font-semibold"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>+ Подключить ещё устройство</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface EmptyDeviceSelectorProps {
  onOpenPairing?: () => void;
}

const EmptyDeviceSelector: React.FC<EmptyDeviceSelectorProps> = ({ onOpenPairing }) => {
  return (
    <div className="w-full flex items-center justify-between pb-3 border-b border-white/5 mb-3.5">
      <span className="text-xs text-slate-500">Нет связанных устройств</span>
      {onOpenPairing && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenPairing();
          }}
          className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold hover:underline flex items-center gap-1"
        >
          <Radio className="w-3 h-3" />
          <span>+ Подключить устройство</span>
        </button>
      )}
    </div>
  );
};

interface DropZoneContentProps {
  statusMessage: { type: 'success' | 'warning' | 'error'; text: string } | null;
  targetName: string | null;
  targetDevice?: PairedDevice;
  onChooseFiles?: (targetDeviceId?: string) => void;
}

const DropZoneContent: React.FC<DropZoneContentProps> = ({
  statusMessage,
  targetName,
  targetDevice,
  onChooseFiles
}) => {
  return (
    <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
      <div
        className={`drop-icon w-13 h-13 p-3 rounded-2xl flex items-center justify-center transition-all ${
          statusMessage?.type === 'warning'
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            : statusMessage?.type === 'error'
            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            : statusMessage?.type === 'success'
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : 'bg-gradient-to-br from-indigo-500/20 via-indigo-600/15 to-cyan-500/20 border border-indigo-400/35 text-indigo-300 shadow-md shadow-indigo-500/15'
        }`}
      >
        {statusMessage?.type === 'warning' ? (
          <Ban className="w-6 h-6 text-amber-400" />
        ) : statusMessage?.type === 'error' ? (
          <AlertCircle className="w-6 h-6 text-rose-400" />
        ) : statusMessage?.type === 'success' ? (
          <FileCheck className="w-6 h-6 text-emerald-400" />
        ) : (
          <UploadCloud className="w-6 h-6" />
        )}
      </div>

      <div className="min-h-[44px] flex flex-col justify-center">
        {/* Status message text (always visible when present, hides idle/drag texts) */}
        {statusMessage ? (
          <div
            className={`text-sm font-bold tracking-tight ${
              statusMessage.type === 'warning'
                ? 'text-amber-300'
                : statusMessage.type === 'error'
                ? 'text-rose-400'
                : 'text-white'
            }`}
          >
            {statusMessage.text}
          </div>
        ) : (
          <>
            {/* Idle text — hidden by CSS when .drop-active is on parent */}
            <div className="drop-text-idle text-sm font-bold tracking-tight text-white">
              Перетащите файлы, архивы или папки сюда
            </div>
            {/* Drag text — shown by CSS when .drop-active is on parent */}
            <div className="drop-text-drag text-sm font-bold tracking-tight text-white">
              {targetName
                ? `Отпустите для отправки на ${targetName}!`
                : 'Отпустите файлы или папки сюда!'}
            </div>
          </>
        )}

        {statusMessage?.type === 'warning' ? (
          <p className="text-xs text-slate-400 mt-0.5">
            Связь сохранена, но приём временно запрещён вторым клиентом
          </p>
        ) : (
          <>
            <p className="drop-text-idle text-xs text-slate-400 mt-0.5">
              {targetName
                ? 'Прямая P2P-передача'
                : 'Подключите устройство для отправки файлов'}
            </p>
            <p className="drop-text-drag text-xs text-slate-400 mt-0.5">
              {targetName
                ? `Прямая отправка на ${targetName}`
                : 'Файлы сразу отправятся'}
            </p>
          </>
        )}
      </div>

      {onChooseFiles && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChooseFiles(targetDevice?.id);
          }}
          className="pointer-events-auto text-xs bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-95 text-white font-semibold px-4 py-2 rounded-xl shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5 mt-1"
        >
          <FileUp className="w-3.5 h-3.5" />
          <span>{targetName ? `Выбрать для ${targetName}` : 'Выбрать в Finder'}</span>
        </button>
      )}
    </div>
  );
};

export const DropZone: React.FC<DropZoneProps> = React.memo(({
  onFilesDropped,
  targetFolder,
  onChooseFiles,
  devices = [],
  selectedDeviceId,
  onSelectDevice,
  onOpenPairing
}) => {
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  const zoneRef = useRef<HTMLDivElement>(null);
  const isDragActiveRef = useRef(false);
  /** Stable ref to latest props for use inside window-level listeners */
  const propsRef = useRef({ onFilesDropped, devices, selectedDeviceId });
  propsRef.current = { onFilesDropped, devices, selectedDeviceId };

  const targetDevice = devices.find((d) => d.id === selectedDeviceId) || devices[0];
  const targetName = targetDevice ? (targetDevice.customName || targetDevice.originalName) : null;
  const targetNameRef = useRef(targetName);
  targetNameRef.current = targetName;

  const setStatusRef = useRef(setStatusMessage);
  setStatusRef.current = setStatusMessage;

  // Ensure .drop-active class persists across React re-renders without DOM blink
  useLayoutEffect(() => {
    if (isDragActiveRef.current && zoneRef.current) {
      zoneRef.current.classList.add('drop-active');
    }
  });

  /**
   * Window-level geometry-based drag tracking.
   * Instead of relying on which DOM element receives the event (child vs parent),
   * we check cursor position against the zone's bounding rect on every dragover.
   * This makes children, scroll containers, and transitions completely irrelevant.
   */
  useEffect(() => {
    const el = zoneRef.current;
    if (!el) return;

    const isFileDrag = (e: DragEvent): boolean =>
      !!e.dataTransfer && Array.from(e.dataTransfer.types).some(t => t.toLowerCase() === 'files');

    const setActive = (active: boolean): void => {
      if (isDragActiveRef.current === active) return;
      isDragActiveRef.current = active;
      if (el.classList.contains('drop-active') !== active) {
        el.classList.toggle('drop-active', active);
      }
    };

    const isInsideZone = (e: DragEvent): boolean => {
      const r = el.getBoundingClientRect();
      // Hysteresis margin: entering requires crossing physical bounds;
      // leaving requires moving 8px away, preventing border flutter/shimmer.
      const buffer = isDragActiveRef.current ? 8 : 0;
      return (
        e.clientX >= r.left - buffer &&
        e.clientX <= r.right + buffer &&
        e.clientY >= r.top - buffer &&
        e.clientY <= r.bottom + buffer
      );
    };

    let leaveTimeout: ReturnType<typeof setTimeout> | null = null;

    const clearLeaveTimeout = (): void => {
      if (leaveTimeout) {
        clearTimeout(leaveTimeout);
        leaveTimeout = null;
      }
    };

    const forceReset = (): void => {
      clearLeaveTimeout();
      setActive(false);
    };

    const handleWindowDragOver = (e: DragEvent): void => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';

      // As long as dragover is firing, cursor is active within the window. Clear pending leave timer.
      clearLeaveTimeout();

      setActive(isInsideZone(e));
    };

    const handleWindowDrop = (e: DragEvent): void => {
      e.preventDefault();
      const wasInside = isInsideZone(e);
      forceReset();

      if (wasInside && e.dataTransfer?.files.length) {
        const files = Array.from(e.dataTransfer.files);
        const paths = files
          .map((f: any) => {
            if (window.macdrop?.getPathForFile) {
              try {
                const p = window.macdrop.getPathForFile(f);
                if (p) return p;
              } catch {}
            }
            return f.path || '';
          })
          .filter(Boolean);

        if (paths.length > 0) {
          const { onFilesDropped: sendFiles, devices: devs, selectedDeviceId: selId } = propsRef.current;
          const td = devs.find((d) => d.id === selId) || devs[0];
          const effectiveTargetId = td?.id;
          const tName = targetNameRef.current;

          Promise.resolve(sendFiles(paths, effectiveTargetId))
            .then((res: any) => {
              if (Array.isArray(res) && res.length > 0) {
                const blocked = res.find(
                  (r: any) =>
                    r.error &&
                    (r.error.includes('отключил приём') ||
                      r.error.includes('выключен приём') ||
                      r.error.includes('403'))
                );
                const failed = res.find((r: any) => !r.success);

                if (blocked) {
                  setStatusRef.current({
                    type: 'warning',
                    text: `${tName || 'Устройство'}: выключен приём файлов`
                  });
                } else if (failed) {
                  setStatusRef.current({
                    type: 'error',
                    text: failed.error || 'Ошибка при отправке файла'
                  });
                } else {
                  setStatusRef.current({
                    type: 'success',
                    text: tName
                      ? `Отправлено ${files.length} файл(ов) на ${tName}!`
                      : `Отправлено ${files.length} файл(ов)!`
                  });
                }
              } else {
                setStatusRef.current({
                  type: 'success',
                  text: tName
                    ? `Отправлено ${files.length} файл(ов) на ${tName}!`
                    : `Отправлено ${files.length} файл(ов)!`
                });
              }
            })
            .catch((err: any) => {
              const msg = err?.message || '';
              if (
                msg.includes('отключил приём') ||
                msg.includes('выключен приём') ||
                msg.includes('403')
              ) {
                setStatusRef.current({
                  type: 'warning',
                  text: `${tName || 'Устройство'}: выключен приём файлов`
                });
              } else {
                setStatusRef.current({
                  type: 'error',
                  text: msg || 'Ошибка отправки'
                });
              }
            });

          setTimeout(() => setStatusRef.current(null), 4000);
        }
      }
    };

    /**
     * In Chromium, dragleave coordinates are 0,0 and relatedTarget is null on child element transitions.
     * We debounce deactivation: if the user is merely crossing an internal DOM element,
     * the next dragover will arrive within a few milliseconds and cancel this timeout.
     * If the user truly left the window, dragover stops, and after 300ms we deactivate cleanly.
     */
    const handleWindowDragLeave = (): void => {
      clearLeaveTimeout();
      leaveTimeout = setTimeout(() => {
        setActive(false);
        leaveTimeout = null;
      }, 300);
    };

    const handleVisibilityChange = (): void => {
      if (document.hidden) forceReset();
    };

    const handleDragEnd = (): void => forceReset();

    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('dragend', handleDragEnd);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearLeaveTimeout();
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('dragend', handleDragEnd);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <div
      ref={zoneRef}
      className={`drop-zone relative rounded-2xl p-5 text-center orbital-glow border-2 ${
        statusMessage?.type === 'warning'
          ? 'border-dashed border-amber-500/40 bg-amber-500/5'
          : statusMessage?.type === 'error'
          ? 'border-dashed border-rose-500/40 bg-rose-500/5'
          : 'border-dashed border-indigo-500/30 bg-gradient-to-b from-[#181b26]/70 to-[#10121a]/90 hover:border-indigo-400/60 hover:shadow-lg hover:shadow-indigo-500/10'
      }`}
    >
      <div>
        {devices.length > 0 && (
          <DeviceSelector
            devices={devices}
            targetDevice={targetDevice}
            onSelectDevice={onSelectDevice}
            onOpenPairing={onOpenPairing}
          />
        )}

        {devices.length === 0 && (
          <EmptyDeviceSelector onOpenPairing={onOpenPairing} />
        )}

        <DropZoneContent
          statusMessage={statusMessage}
          targetName={targetName}
          targetDevice={targetDevice}
          onChooseFiles={onChooseFiles}
        />
      </div>
    </div>
  );
});

