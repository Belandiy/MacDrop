import React, { useState, useEffect } from 'react';
import { X, Bell, Power, Sliders, Terminal } from 'lucide-react';
import { TargetFolderSetting } from './settings/TargetFolderSetting';
import { ToggleSetting } from './settings/ToggleSetting';
import { UpnpStatusSection, UpnpStatus } from './settings/UpnpStatusSection';
import { ConnectedDevicesSection } from './settings/ConnectedDevicesSection';
import { LogsSection } from './settings/LogsSection';

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
  const [activeTab, setActiveTab] = useState<'general' | 'logs'>('general');
  const [upnpStatus, setUpnpStatus] = useState<UpnpStatus | null>(null);
  const [errorCount, setErrorCount] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      if (window.macdrop?.getUpnpStatus) {
        window.macdrop.getUpnpStatus().then(setUpnpStatus).catch(() => {});
      }
      if (window.macdrop?.getLogs) {
        window.macdrop.getLogs().then((logs) => {
          const errors = logs.filter((l) => l.level === 'error').length;
          setErrorCount(errors);
        }).catch(() => {});
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const unsubEntry = window.macdrop?.onLogEntry?.((entry) => {
      if (entry.level === 'error') {
        setErrorCount((prev) => prev + 1);
      }
    });
    const unsubCleared = window.macdrop?.onLogsCleared?.(() => {
      setErrorCount(0);
    });
    return () => {
      unsubEntry?.();
      unsubCleared?.();
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="bg-[#171a23] border border-white/[0.12] rounded-3xl w-full max-w-[400px] shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-1.5 bg-[#0d0f15] p-1 rounded-xl border border-white/[0.08]">
            <button
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors border ${
                activeTab === 'general'
                  ? 'bg-white/10 text-white border-white/10 shadow-sm'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>Основные</span>
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors border ${
                activeTab === 'logs'
                  ? 'bg-white/10 text-white border-white/10 shadow-sm'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              <span>Логи</span>
              {errorCount > 0 && (
                <span className="px-1.5 py-0.2 bg-red-500/20 text-red-400 text-[10px] font-bold rounded-full border border-red-500/30">
                  {errorCount}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Content - Invariant height for both tabs */}
        <div className="p-5 flex flex-col gap-4 h-[420px] max-h-[420px] overflow-y-auto">
          {activeTab === 'general' ? (
            <>
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
            </>
          ) : (
            <LogsSection />
          )}
        </div>
      </div>
    </div>
  );
};
