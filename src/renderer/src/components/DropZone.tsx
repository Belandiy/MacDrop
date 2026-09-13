import React, { useState } from 'react';
import { UploadCloud, FileCheck, Copy, Ban, AlertCircle, Laptop, Monitor, Radio } from 'lucide-react';
import { PairedDevice } from './DeviceDetailView';

interface DropZoneProps {
  onFilesDropped: (filePaths: string[], targetDeviceId?: string) => Promise<any> | void;
  targetFolder: string;
  onChooseFiles?: (targetDeviceId?: string) => void;
  devices?: PairedDevice[];
  selectedDeviceId?: string | null;
  onSelectDevice?: (deviceId: string) => void;
  onOpenPairing?: () => void;
}

export const DropZone: React.FC<DropZoneProps> = ({
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
      className={`relative border-2 border-dashed rounded-2xl p-5 text-center transition-all duration-200 ${
        isDragging
          ? 'border-blue-500 bg-blue-500/10 scale-[1.02] shadow-lg shadow-blue-500/20'
          : statusMessage?.type === 'warning'
          ? 'border-amber-500/40 bg-amber-500/5'
          : statusMessage?.type === 'error'
          ? 'border-red-500/40 bg-red-500/5'
          : 'border-white/15 bg-[#252528]/50 hover:border-white/25 hover:bg-[#252528]/80'
      }`}
    >
      {/* Target Device Selector Bar */}
      {devices.length > 0 && (
        <div className="w-full flex items-center justify-between pb-3 border-b border-white/5 mb-3">
          <span className="text-xs text-zinc-400 font-medium">Получатель:</span>

          {devices.length === 1 ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-xs text-white border border-white/5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  devices[0].connectionMode === 'remote' ? 'bg-blue-400' : 'bg-emerald-400'
                }`}
              />
              <span className="font-medium truncate max-w-[170px]">
                {devices[0].customName || devices[0].originalName}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {devices.map((d) => {
                const isSelected = d.id === (selectedDeviceId || devices[0]?.id);
                const isRemote = d.connectionMode === 'remote';
                const isMac =
                  d.id.toUpperCase().startsWith('MAC') ||
                  (d.originalName || '').toLowerCase().includes('mac');

                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDevice?.(d.id);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-400/40 ring-1 ring-blue-400/30'
                        : 'bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 hover:border-white/15'
                    }`}
                    title={`${d.customName || d.originalName} (${isRemote ? 'Удаленно' : 'Локальная сеть'})`}
                  >
                    {isMac ? (
                      <Laptop className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-zinc-400'}`} />
                    ) : (
                      <Monitor className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-zinc-400'}`} />
                    )}
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected
                          ? 'bg-white'
                          : isRemote
                          ? 'bg-blue-400'
                          : 'bg-emerald-400'
                      }`}
                    />
                    <span className="truncate max-w-[120px]">
                      {d.customName || d.originalName}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {devices.length === 0 && (
        <div className="w-full flex items-center justify-between pb-3 border-b border-white/5 mb-3">
          <span className="text-xs text-zinc-500">Нет связанных устройств</span>
          {onOpenPairing && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenPairing();
              }}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium hover:underline flex items-center gap-1"
            >
              <Radio className="w-3 h-3" />
              <span>+ Подключить устройство</span>
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col items-center justify-center gap-2">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
            statusMessage?.type === 'warning'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : statusMessage?.type === 'error'
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : statusMessage?.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : isDragging
              ? 'bg-blue-600 text-white'
              : 'bg-zinc-800 text-blue-400'
          }`}
        >
          {statusMessage?.type === 'warning' ? (
            <Ban className="w-6 h-6 text-amber-400" />
          ) : statusMessage?.type === 'error' ? (
            <AlertCircle className="w-6 h-6 text-red-400" />
          ) : statusMessage?.type === 'success' ? (
            <FileCheck className="w-6 h-6 text-emerald-400" />
          ) : (
            <UploadCloud className="w-6 h-6" />
          )}
        </div>

        <div>
          <div
            className={`text-sm font-medium ${
              statusMessage?.type === 'warning'
                ? 'text-amber-300'
                : statusMessage?.type === 'error'
                ? 'text-red-400'
                : 'text-white'
            }`}
          >
            {statusMessage
              ? statusMessage.text
              : isDragging
              ? targetName
                ? `Отпустите для отправки на ${targetName}!`
                : 'Отпустите файлы сюда!'
              : 'Перетащите файлы сюда'}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            {statusMessage?.type === 'warning'
              ? 'Связь сохранена, но приём временно запрещён вторым клиентом'
              : isDragging && targetName
              ? `Файлы сразу отправятся на ${targetName}`
              : targetName
              ? `Файлы мгновенно синхронизируются с ${targetName}`
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
            className="text-xs bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-medium px-3.5 py-1.5 rounded-xl border border-white/10 transition-colors shadow-sm"
          >
            {targetName ? `Выбрать файл(ы) для ${targetName}` : 'Выбрать файл(ы)'}
          </button>
        )}

        <div className="text-[11px] text-zinc-400 bg-white/5 px-2.5 py-1 rounded-full mt-1 border border-white/5 flex items-center gap-1">
          <Copy className="w-3 h-3 text-zinc-400" />
          <span>или сохраняйте их в {targetFolder.split(/[\\/]/).filter(Boolean).pop()}</span>
        </div>
      </div>
    </div>
  );
};
