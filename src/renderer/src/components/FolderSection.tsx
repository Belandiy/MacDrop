import React from 'react';
import { Folder, FolderOpen, ExternalLink, HardDrive } from 'lucide-react';

interface FolderSectionProps {
  targetFolder: string;
  onSelectFolder: () => void;
  onOpenFolder: () => void;
}

// ⚡ Bolt Performance Optimization:
// Wrapped FolderSection in React.memo to prevent unnecessary re-renders when parent App state
// updates. Dependencies (targetFolder, callbacks) remain stable most of the time.
export const FolderSection: React.FC<FolderSectionProps> = React.memo(({
  targetFolder,
  onSelectFolder,
  onOpenFolder
}) => {
  // Extract folder name and short display
  const folderName = targetFolder.split(/[\\/]/).filter(Boolean).pop() || 'MacDrop';
  const isDriveE = targetFolder.toUpperCase().startsWith('E:');

  return (
    <div className="bg-[#111319]/90 border border-white/[0.08] rounded-2xl p-4 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-slate-300">Куда сохраняются файлы</span>
        </div>
        {isDriveE && (
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
            <HardDrive className="w-3 h-3" />
            Диск E:
          </span>
        )}
      </div>

      <div className="bg-[#171a23] rounded-xl p-2.5 border border-white/[0.06] flex items-center justify-between gap-2">
        <div className="truncate text-xs font-mono text-slate-200" title={targetFolder}>
          {targetFolder}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <button
          onClick={onSelectFolder}
          className="flex items-center justify-center gap-1.5 bg-white/[0.05] hover:bg-white/[0.1] active:scale-95 text-slate-200 text-xs font-semibold py-2 px-3 rounded-xl border border-white/[0.08] transition-all"
        >
          <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
          <span>Выбрать другую...</span>
        </button>

        <button
          onClick={onOpenFolder}
          className="flex items-center justify-center gap-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 active:scale-95 text-cyan-300 text-xs font-semibold py-2 px-3 rounded-xl border border-cyan-500/30 transition-all"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Открыть папку</span>
        </button>
      </div>
    </div>
  );
});
