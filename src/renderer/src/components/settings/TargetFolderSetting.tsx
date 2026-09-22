import React from 'react';
import { HardDrive } from 'lucide-react';

interface TargetFolderSettingProps {
  targetFolder: string;
  onSelectFolder: () => void;
}

export const TargetFolderSetting: React.FC<TargetFolderSettingProps> = ({
  targetFolder,
  onSelectFolder,
}) => {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
        <HardDrive className="w-3.5 h-3.5 text-slate-400" />
        <span>Папка для входящих файлов</span>
      </label>
      <div className="flex items-center gap-2">
        <div className="bg-[#111319] text-xs text-slate-200 px-3 py-2 rounded-xl border border-white/[0.08] truncate flex-1 font-mono">
          {targetFolder}
        </div>
        <button
          onClick={onSelectFolder}
          className="bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 text-white text-xs font-semibold px-3 py-2 rounded-xl border border-white/[0.08] transition-all shrink-0"
        >
          Обзор
        </button>
      </div>
    </div>
  );
};
