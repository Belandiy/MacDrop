import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ToggleSettingProps {
  title: string;
  description: string;
  icon: LucideIcon;
  iconColorClass: string;
  iconBgClass: string;
  iconBorderClass: string;
  isActive: boolean;
  onToggle: (enable: boolean) => void;
}

export const ToggleSetting: React.FC<ToggleSettingProps> = ({
  title,
  description,
  icon: Icon,
  iconColorClass,
  iconBgClass,
  iconBorderClass,
  isActive,
  onToggle,
}) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-xl ${iconBgClass} ${iconColorClass} flex items-center justify-center border ${iconBorderClass}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs font-bold text-white">{title}</div>
          <div className="text-[11px] text-slate-400">{description}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onToggle(!isActive)}
        className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
          isActive ? 'bg-indigo-600' : 'bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform shadow-md ${
            isActive ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};
