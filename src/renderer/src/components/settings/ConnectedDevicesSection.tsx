import React from 'react';
import { Unlink } from 'lucide-react';
import { PairedDevice } from '../SettingsModal';

interface ConnectedDevicesSectionProps {
  pairedDevices: PairedDevice[];
  onUnpairDevice: (deviceId?: string) => void;
}

export const ConnectedDevicesSection: React.FC<ConnectedDevicesSectionProps> = ({
  pairedDevices,
  onUnpairDevice,
}) => {
  if (pairedDevices.length === 0) {
    return null;
  }

  return (
    <>
      <div className="h-px bg-white/[0.08]" />
      <div className="flex flex-col gap-2 pt-1">
        <div className="text-xs font-bold text-white">
          Связанные устройства ({pairedDevices.length})
        </div>
        <div className="flex flex-col gap-2 max-h-36 overflow-y-auto">
          {pairedDevices.map((dev) => (
            <div
              key={dev.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-[#111319] border border-white/[0.06]"
            >
              <div className="truncate">
                <div className="text-xs font-semibold text-slate-200 truncate">
                  {dev.customName || dev.originalName}
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  {dev.originalName} • {dev.id}
                </div>
              </div>
              <button
                onClick={() => onUnpairDevice(dev.id)}
                className="flex items-center gap-1 text-[11px] text-rose-300 hover:text-white bg-rose-500/15 hover:bg-rose-500/25 px-2.5 py-1.5 rounded-lg border border-rose-500/25 transition-colors shrink-0 ml-2 font-semibold"
                title="Разорвать связь с этим устройством"
              >
                <Unlink className="w-3 h-3" />
                <span>Отвязать</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
