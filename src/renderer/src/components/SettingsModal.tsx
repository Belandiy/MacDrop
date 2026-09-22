import React, { useState, useEffect } from 'react';
import { X, Bell, Power } from 'lucide-react';
import { TargetFolderSetting } from './settings/TargetFolderSetting';
import { ToggleSetting } from './settings/ToggleSetting';
import { UpnpStatusSection, UpnpStatus } from './settings/UpnpStatusSection';
import { ConnectedDevicesSection } from './settings/ConnectedDevicesSection';

export interface PairedDevice {
  id: string;
  originalName: string;
  customName: string;
  ip: string;
  port: number;
  pairedAt: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  autoStart: boolean;
  notifications: boolean;
  pairedDevices?: PairedDevice[];
  onToggleAutoStart: (enable: boolean) => void;
  onToggleNotifications: (enable: boolean) => void;
  onUnpairDevice: (deviceId?: string) => void;
  onSelectFolder: () => void;
  targetFolder: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  autoStart,
  notifications,
  pairedDevices = [],
  onToggleAutoStart,
  onToggleNotifications,
  onUnpairDevice,
  onSelectFolder,
  targetFolder
}) => {
  const [upnpStatus, setUpnpStatus] = useState<UpnpStatus | null>(null);

  useEffect(() => {
    if (isOpen && window.macdrop?.getUpnpStatus) {
      window.macdrop.getUpnpStatus().then(setUpnpStatus).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#171a23] border border-white/[0.12] rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <h2 className="text-sm font-bold text-white tracking-tight">Настройки MacDrop</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List of settings */}
        <div className="p-5 flex flex-col gap-4">
          <TargetFolderSetting
            targetFolder={targetFolder}
            onSelectFolder={onSelectFolder}
          />

          <div className="h-px bg-white/[0.08]" />

          <ToggleSetting
            title="Автозапуск с системой"
            description="Запуск в фоновом режиме"
            icon={Power}
            iconColorClass="text-indigo-300"
            iconBgClass="bg-indigo-500/15"
            iconBorderClass="border-indigo-500/25"
            isActive={autoStart}
            onToggle={onToggleAutoStart}
          />

          <ToggleSetting
            title="Всплывающие уведомления"
            description="Системные баннеры о файлах"
            icon={Bell}
            iconColorClass="text-violet-300"
            iconBgClass="bg-violet-500/15"
            iconBorderClass="border-violet-500/25"
            isActive={notifications}
            onToggle={onToggleNotifications}
          />

          <UpnpStatusSection upnpStatus={upnpStatus} />

          <ConnectedDevicesSection
            pairedDevices={pairedDevices}
            onUnpairDevice={onUnpairDevice}
          />
        </div>
      </div>
    </div>
  );
};
