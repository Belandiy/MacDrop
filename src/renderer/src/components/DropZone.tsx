import React, { useState } from 'react';
import { UploadCloud, FileCheck, Copy } from 'lucide-react';

interface DropZoneProps {
  onFilesDropped: (filePaths: string[]) => void;
  targetFolder: string;
}

export const DropZone: React.FC<DropZoneProps> = ({ onFilesDropped, targetFolder }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [recentDropSuccess, setRecentDropSuccess] = useState<string | null>(null);

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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      // In Electron, File objects have a .path property!
      const paths = files.map((f: any) => f.path).filter(Boolean);
      if (paths.length > 0) {
        onFilesDropped(paths);
        setRecentDropSuccess(`Отправлено ${files.length} файл(ов)!`);
        setTimeout(() => setRecentDropSuccess(null), 3000);
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
          : 'border-white/15 bg-[#252528]/50 hover:border-white/25 hover:bg-[#252528]/80'
      }`}
    >
      <div className="flex flex-col items-center justify-center gap-2">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
          isDragging ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-blue-400'
        }`}>
          {recentDropSuccess ? (
            <FileCheck className="w-6 h-6 text-emerald-400" />
          ) : (
            <UploadCloud className="w-6 h-6" />
          )}
        </div>

        <div>
          <div className="text-sm font-medium text-white">
            {recentDropSuccess || (isDragging ? 'Отпустите файлы сюда!' : 'Перетащите файлы сюда')}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Файлы мгновенно синхронизируются со вторым компьютером
          </p>
        </div>

        <div className="text-[11px] text-zinc-400 bg-white/5 px-2.5 py-1 rounded-full mt-1 border border-white/5 flex items-center gap-1">
          <Copy className="w-3 h-3 text-zinc-400" />
          <span>или просто сохраняйте их в {targetFolder.split(/[\\/]/).filter(Boolean).pop()}</span>
        </div>
      </div>
    </div>
  );
};
