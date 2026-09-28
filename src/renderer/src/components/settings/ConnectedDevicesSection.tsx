import React from 'react';
import { Unlink } from 'lucide-react';
import { PairedDevice } from '../SettingsModal';
import { useTranslation } from '../../i18n';

interface ConnectedDevicesSectionProps {
  pairedDevices: PairedDevice[];
  onUnpairDevice: (deviceId?: string) => void;
}

export const ConnectedDevicesSection: React.FC<ConnectedDevicesSectionProps> = ({
  pairedDevices,
  onUnpairDevice,
}) => {
  const { t } = useTranslation();

  if (pairedDevices.length === 0) {
    return null;
  }

  return (
    <>
      <div className="h-px bg-[#2C2C2E]" />
      <div className="flex flex-col gap-2 pt-0.5 select-none">
        <div className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider">
          {t('settings.pairedDevicesCount', { count: pairedDevices.length })}
        </div>
        <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
          {pairedDevices.map((dev) => (
            <div
              key={dev.id}
              className="flex items-center justify-between p-2 rounded-[6px] bg-[#1A1A1A] border border-[#2C2C2E]"
            >
              <div className="truncate pr-2">
                <div className="text-[12px] font-medium text-[#F2F2F7] truncate">
                  {dev.customName || dev.originalName}
                </div>
                <div className="text-[10px] text-[#8E8E93] font-mono truncate">
                  {dev.originalName} • {dev.id}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onUnpairDevice(dev.id)}
                className="flex items-center gap-1 text-[11px] text-[#FF453A] hover:text-white bg-[#FF453A]/10 hover:bg-[#FF453A]/20 px-2 py-1 rounded-[4px] border border-[#FF453A]/30 transition-colors shrink-0 cursor-pointer font-medium"
                title={t('devices.unlinkConfirm')}
              >
                <Unlink className="w-3 h-3" />
                <span>{t('devices.unlink')}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
