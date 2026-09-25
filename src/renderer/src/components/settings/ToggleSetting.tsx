import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ToggleSettingProps {
  title: string;
  description: string;
  icon: LucideIcon;
  iconColorClass?: string;
  iconBgClass?: string;
  iconBorderClass?: string;
  isActive: boolean;
  onToggle: (enable: boolean) => void;
}

export const ToggleSetting: React.FC<ToggleSettingProps> = ({
  title,
  description,
  icon: Icon,
  isActive,
  onToggle,
}) => {
  return (
    <div className="flex items-center justify-between py-1 select-none">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-[6px] bg-[#202022] border border-[#2C2C2E] flex items-center justify-center text-[#8E8E93] shrink-0">
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div>
          <div className="text-[12px] font-medium text-[#F2F2F7] leading-tight">{title}</div>
          <div className="text-[11px] text-[#8E8E93] leading-tight mt-0.5">{description}</div>
        </div>
      </div>

      {/* Native Apple Toggle Switch */}
      <button
        type="button"
        onClick={() => onToggle(!isActive)}
        className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
          isActive ? 'bg-[#34C759]' : 'bg-[#3A3A3C]'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform shadow-[0_1px_2px_rgba(0,0,0,0.4)] ${
            isActive ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};
