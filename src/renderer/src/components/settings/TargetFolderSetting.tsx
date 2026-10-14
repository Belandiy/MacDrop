import React from 'react';
import { Folder } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface TargetFolderSettingProps {
  targetFolder: string;
  onSelectFolder: () => void;
}

export const TargetFolderSetting: React.FC<TargetFolderSettingProps> = ({
  targetFolder,
  onSelectFolder,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-1.5 select-none">
      <label className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider flex items-center gap-1.5">
        <Folder className="w-3 h-3 text-[#007AFF]" />
        <span>{t('folder.vaultStorage')}</span>
      </label>
      <div className="flex items-center gap-2">
        <div
          className="bg-black/30 text-[11px] text-[#D1D1D6] px-2.5 py-1.5 rounded-[6px] border border-white/[0.08] truncate flex-1 font-mono"
          title={targetFolder}
        >
          {targetFolder}
        </div>
        <button
          type="button"
          onClick={onSelectFolder}
          className="px-3 py-1.5 text-[11px] font-medium bg-white/[0.08] hover:bg-white/[0.14] text-[#D1D1D6] hover:text-white border border-white/[0.1] rounded-[6px] shadow-[0_0.5px_1px_rgba(0,0,0,0.4)] transition-colors shrink-0 cursor-pointer"
        >
          {t('folder.browse')}
        </button>
      </div>
    </div>
  );
};
