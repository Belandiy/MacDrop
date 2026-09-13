import React from 'react';
import { Folder, FolderOpen, ExternalLink, HardDrive } from 'lucide-react';

interface FolderSectionProps {
  targetFolder: string;
  onSelectFolder: () => void;
  onOpenFolder: () => void;
}

export const FolderSection: React.FC<FolderSectionProps> = ({
  targetFolder,
  onSelectFolder,
  onOpenFolder
}) => {
  // Extract folder name and short display
  const folderName = targetFolder.split(/[\\/]/).filter(Boolean).pop() || 'MacDrop';
  const isDriveE = targetFolder.toUpperCase().startsWith('E:');

  return (
    <div className="bg-[#2c2c2e]/90 border border-white/10 rounded-2xl p-4 shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-medium text-zinc-300">Куда сохраняются файлы</span>
        </div>
        {isDriveE && (
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
            <HardDrive className="w-3 h-3" />
            Диск E:
          </span>
        )}
      </div>

      <div className="bg-[#1c1c1e] rounded-xl p-2.5 border border-white/5 flex items-center justify-between gap-2">
        <div className="truncate text-xs font-mono text-zinc-200" title={targetFolder}>
          {targetFolder}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <button
          onClick={onSelectFolder}
          className="flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-white text-xs font-medium py-2 px-3 rounded-xl border border-white/10 transition-colors"
        >
          <FolderOpen className="w-3.5 h-3.5 text-zinc-300" />
          <span>Выбрать другую...</span>
        </button>

        <button
          onClick={onOpenFolder}
          className="flex items-center justify-center gap-1.5 bg-blue-600/20 hover:bg-blue-600/30 active:bg-blue-600/40 text-blue-400 text-xs font-medium py-2 px-3 rounded-xl border border-blue-500/30 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Открыть папку</span>
        </button>
      </div>
    </div>
  );
};
