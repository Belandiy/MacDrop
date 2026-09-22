import React from 'react';
import { CheckCircle2, Ban } from 'lucide-react';

interface DeviceReceiveToggleProps {
  isReceiveEnabled: boolean;
  handleToggleReceive: (enabled: boolean) => void;
}

export const DeviceReceiveToggle: React.FC<DeviceReceiveToggleProps> = ({
  isReceiveEnabled,
  handleToggleReceive
}) => {
  return (
    <div className="bg-[#171a23] border border-white/[0.06] rounded-xl p-3 flex items-center justify-between">
      <div>
        <div className="text-xs font-semibold text-white flex items-center gap-1.5">
          {isReceiveEnabled ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Ban className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span>Приём файлов от этого устройства</span>
        </div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          {isReceiveEnabled
            ? 'Разрешено: устройство может отправлять вам файлов'
            : 'Запрещено: приём временно заблокирован без потери связи'}
        </div>
      </div>

      <div className="flex items-center bg-[#111319] p-0.5 rounded-xl border border-white/[0.08] shrink-0 ml-3">
        <button
          onClick={() => handleToggleReceive(true)}
          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
            isReceiveEnabled
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Вкл
        </button>
        <button
          onClick={() => handleToggleReceive(false)}
          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
            !isReceiveEnabled
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Выкл
        </button>
      </div>
    </div>
  );
};
