import React, { useState } from 'react';
import { UploadCloud, FileCheck, Copy, Ban, AlertCircle } from 'lucide-react';

interface DropZoneProps {
  onFilesDropped: (filePaths: string[]) => Promise<any> | void;
  targetFolder: string;
  onChooseFiles?: () => void;
}

export const DropZone: React.FC<DropZoneProps> = ({ onFilesDropped, targetFolder, onChooseFiles }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

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
          const res = await onFilesDropped(paths);
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
                text: 'У второго устройства выключен приём файлов'
              });
            } else if (failed) {
              setStatusMessage({
                type: 'error',
                text: failed.error || 'Ошибка при отправке файла'
              });
            } else {
              setStatusMessage({
                type: 'success',
                text: `Отправлено ${files.length} файл(ов)!`
              });
            }
          } else {
            setStatusMessage({
              type: 'success',
              text: `Отправлено ${files.length} файл(ов)!`
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
              text: 'У второго устройства выключен приём файлов'
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
      className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-200 ${
        isDragging
          ? 'border-blue-500 bg-blue-500/10 scale-[1.02] shadow-lg shadow-blue-500/20'
          : statusMessage?.type === 'warning'
          ? 'border-amber-500/40 bg-amber-500/5'
          : statusMessage?.type === 'error'
          ? 'border-red-500/40 bg-red-500/5'
          : 'border-white/15 bg-[#252528]/50 hover:border-white/25 hover:bg-[#252528]/80'
      }`}
    >
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
              ? 'Отпустите файлы сюда!'
              : 'Перетащите файлы сюда'}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            {statusMessage?.type === 'warning'
              ? 'Связь сохранена, но приём временно запрещён вторым клиентом'
              : 'Файлы мгновенно синхронизируются со вторым компьютером'}
          </p>
        </div>

        {onChooseFiles && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChooseFiles();
            }}
            className="text-xs bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-medium px-3.5 py-1.5 rounded-xl border border-white/10 transition-colors shadow-sm"
          >
            Выбрать файл(ы)
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
