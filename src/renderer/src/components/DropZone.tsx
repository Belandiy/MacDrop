import React, { useState, useRef, useEffect } from 'react';
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
  isDragging: boolean;
  targetName: string | null;
  targetDevice?: PairedDevice;
  onChooseFiles?: (targetDeviceId?: string) => void;
}

const DropZoneContent: React.FC<DropZoneContentProps> = ({
  statusMessage,
  isDragging,
  targetName,
  targetDevice,
  onChooseFiles
}) => {
  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div
        className={`w-13 h-13 p-3 rounded-2xl flex items-center justify-center transition-all ${
          statusMessage?.type === 'warning'
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            : statusMessage?.type === 'error'
            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            : statusMessage?.type === 'success'
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : isDragging
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40'
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

      <div>
        <div
          className={`text-sm font-bold tracking-tight ${
            statusMessage?.type === 'warning'
              ? 'text-amber-300'
              : statusMessage?.type === 'error'
              ? 'text-rose-400'
              : 'text-white'
          }`}
        >
          {statusMessage
            ? statusMessage.text
            : isDragging
            ? targetName
              ? `Отпустите для отправки на ${targetName}!`
              : 'Отпустите файлы или папки сюда!'
            : 'Перетащите файлы, архивы или папки сюда'}
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          {statusMessage?.type === 'warning'
            ? 'Связь сохранена, но приём временно запрещён вторым клиентом'
            : isDragging && targetName
            ? `Файлы или папка сразу отправятся на ${targetName}`
            : targetName
            ? `Прямая P2P-передача (папки автоматически упакуются в .zip)`
            : 'Подключите устройство для отправки файлов'}
        </p>
      </div>

      {onChooseFiles && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChooseFiles(targetDevice?.id);
          }}
          className="text-xs bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-95 text-white font-semibold px-4 py-2 rounded-xl shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5 mt-1"
        >
          <FileUp className="w-3.5 h-3.5" />
          <span>{targetName ? `Выбрать для ${targetName}` : 'Выбрать в Finder'}</span>
        </button>
      )}
    </div>
  );
};

// ⚡ Bolt Performance Optimization:
// Wrapped DropZone in React.memo to prevent unnecessary re-renders when parent App updates frequently
// (e.g. during file transfer progress).
export const DropZone: React.FC<DropZoneProps> = React.memo(({
  onFilesDropped,
  targetFolder,
  onChooseFiles,
  devices = [],
  selectedDeviceId,
  onSelectDevice,
  onOpenPairing
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  const targetDevice = devices.find((d) => d.id === selectedDeviceId) || devices[0];
  const targetName = targetDevice ? (targetDevice.customName || targetDevice.originalName) : null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
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
        try {
          const effectiveTargetId = targetDevice?.id;
          const res = await onFilesDropped(paths, effectiveTargetId);
          if (Array.isArray(res) && res.length > 0) {
            const blocked = res.find(
              (r) =>
                r.error &&
                (r.error.includes('отключил приём') ||
                  r.error.includes('выключен приём') ||
                  r.error.includes('403'))
            );
            const failed = res.find((r) => !r.success);

            if (blocked) {
              setStatusMessage({
                type: 'warning',
                text: `${targetName || 'Устройство'}: выключен приём файлов`
              });
            } else if (failed) {
              setStatusMessage({
                type: 'error',
                text: failed.error || 'Ошибка при отправке файла'
              });
            } else {
              setStatusMessage({
                type: 'success',
                text: targetName
                  ? `Отправлено ${files.length} файл(ов) на ${targetName}!`
                  : `Отправлено ${files.length} файл(ов)!`
              });
            }
          } else {
            setStatusMessage({
              type: 'success',
              text: targetName
                ? `Отправлено ${files.length} файл(ов) на ${targetName}!`
                : `Отправлено ${files.length} файл(ов)!`
            });
          }
        } catch (err: any) {
          const msg = err?.message || '';
          if (
            msg.includes('отключил приём') ||
            msg.includes('выключен приём') ||
            msg.includes('403')
          ) {
            setStatusMessage({
              type: 'warning',
              text: `${targetName || 'Устройство'}: выключен приём файлов`
            });
          } else {
            setStatusMessage({
              type: 'error',
              text: msg || 'Ошибка отправки'
            });
          }
        }
        setTimeout(() => setStatusMessage(null), 4000);
      }
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative rounded-2xl p-5 text-center transition-all duration-200 orbital-glow ${
        isDragging
          ? 'border-2 border-indigo-500 bg-indigo-500/15 scale-[1.01] shadow-xl shadow-indigo-500/25'
          : statusMessage?.type === 'warning'
          ? 'border-2 border-dashed border-amber-500/40 bg-amber-500/5'
          : statusMessage?.type === 'error'
          ? 'border-2 border-dashed border-rose-500/40 bg-rose-500/5'
          : 'border border-dashed border-indigo-500/30 bg-gradient-to-b from-[#181b26]/70 to-[#10121a]/90 hover:border-indigo-400/60 hover:shadow-lg hover:shadow-indigo-500/10'
      }`}
    >
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
        isDragging={isDragging}
        targetName={targetName}
        targetDevice={targetDevice}
        onChooseFiles={onChooseFiles}
      />
    </div>
  );
});
