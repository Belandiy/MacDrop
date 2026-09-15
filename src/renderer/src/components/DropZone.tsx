import React, { useState } from 'react';
import { UploadCloud, FileCheck, Copy, Ban, AlertCircle, Laptop, Monitor, Radio, FileUp } from 'lucide-react';
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
      {/* Target Device Selector Bar */}
      {devices.length > 0 && (
        <div className="w-full flex items-center justify-between pb-3 border-b border-white/5 mb-3.5">
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Получатель:</span>

          {devices.length === 1 ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0e1017] text-xs text-white border border-white/10 shadow-sm">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  devices[0].connectionMode === 'remote' ? 'bg-cyan-400 shadow-sm shadow-cyan-400' : 'bg-emerald-400 shadow-sm shadow-emerald-400'
                }`}
              />
              <span className="font-semibold truncate max-w-[170px]">
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
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/35 border border-indigo-400/40 ring-1 ring-indigo-400/30'
                        : 'bg-[#0e1017] hover:bg-white/10 text-slate-300 border border-white/10 hover:border-white/20'
                    }`}
                    title={`${d.customName || d.originalName} (${isRemote ? 'Удаленно' : 'Локальная сеть'})`}
                  >
                    {isMac ? (
                      <Laptop className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                    ) : (
                      <Monitor className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                    )}
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected
                          ? 'bg-white'
                          : isRemote
                          ? 'bg-cyan-400'
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
      )}

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

        <div className="text-[11px] text-slate-400 bg-white/5 px-2.5 py-1 rounded-full mt-1 border border-white/5 flex items-center gap-1">
          <Copy className="w-3 h-3 text-slate-400" />
          <span>или сохраняйте их в <strong className="text-slate-300 font-mono">{targetFolder.split(/[\\/]/).filter(Boolean).pop()}</strong></span>
        </div>
      </div>
    </div>
  );
};
