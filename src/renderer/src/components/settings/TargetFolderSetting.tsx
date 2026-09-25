import React from 'react';
import { Folder } from 'lucide-react';

interface TargetFolderSettingProps {
  targetFolder: string;
  onSelectFolder: () => void;
}

export const TargetFolderSetting: React.FC<TargetFolderSettingProps> = ({
  targetFolder,
  onSelectFolder,
}) => {
  return (
    <div className="flex flex-col gap-1.5 select-none">
      <label className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider flex items-center gap-1.5">
        <Folder className="w-3 h-3 text-[#007AFF]" />
        <span>Папка для входящих файлов</span>
      </label>
      <div className="flex items-center gap-2">
        <div
          className="bg-[#1A1A1A] text-[11px] text-[#D1D1D6] px-2.5 py-1.5 rounded-[5px] border border-[#2C2C2E] truncate flex-1 font-mono"
          title={targetFolder}
        >
          {targetFolder}
        </div>
        <button
          type="button"
          onClick={onSelectFolder}
          className="px-3 py-1.5 text-[11px] font-medium bg-[#2C2C2E] hover:bg-[#38383A] text-[#D1D1D6] hover:text-white border border-[#3A3A3C] rounded-[4px] shadow-[0_0.5px_1px_rgba(0,0,0,0.4)] transition-colors shrink-0 cursor-pointer"
        >
          Обзор...
        </button>
      </div>
    </div>
  );
};
