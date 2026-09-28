import React, { useState, useEffect } from 'react';
import { X, Bell, Power, Sliders, Terminal, RefreshCw, Languages } from 'lucide-react';
import { TargetFolderSetting } from './settings/TargetFolderSetting';
import { ToggleSetting } from './settings/ToggleSetting';
import { UpnpStatusSection, UpnpStatus } from './settings/UpnpStatusSection';
import { ConnectedDevicesSection } from './settings/ConnectedDevicesSection';
import { LogsSection } from './settings/LogsSection';
import { UpdatesSection } from './settings/UpdatesSection';
import { UpdateStateInfo } from '../vite-env';
import { useTranslation, SupportedLanguage } from '../i18n';

export interface PairedDevice {
  id: string;
  originalName: string;
  customName: string;
  ip: string;
  port: number;
  pairedAt: string;
}

export type SettingsTab = 'general' | 'updates' | 'logs';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
  autoStart: boolean;
  notifications: boolean;
  language?: 'ru' | 'en';
  onSetLanguage?: (lang: 'ru' | 'en') => void;
  pairedDevices?: PairedDevice[];
  onToggleAutoStart: (enable: boolean) => void;
  onToggleNotifications: (enable: boolean) => void;
  onUnpairDevice: (deviceId?: string) => void;
  onSelectFolder: () => void;
  targetFolder: string;
  updateState?: UpdateStateInfo;
  onCheckForUpdates?: () => Promise<void>;
  onInstallUpdate?: () => void;
  platform?: string;
  appVersion?: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'general',
  autoStart,
  notifications,
  language,
  onSetLanguage,
  pairedDevices = [],
  onToggleAutoStart,
  onToggleNotifications,
  onUnpairDevice,
  onSelectFolder,
  targetFolder,
  updateState = { status: 'idle' },
  onCheckForUpdates = async () => {},
  onInstallUpdate = () => {},
  platform = window.macdrop?.platform || 'darwin',
  appVersion = window.macdrop?.version || '2.3.5'
}) => {
  const { t, language: ctxLanguage, setLanguage, availableLanguages } = useTranslation();
  const activeLanguage: SupportedLanguage = language || ctxLanguage;
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [upnpStatus, setUpnpStatus] = useState<UpnpStatus | null>(null);
  const [errorCount, setErrorCount] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
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
  }, [isOpen, initialTab]);

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

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isDownloading = updateState.status === 'downloading';
  const isDownloaded = updateState.status === 'downloaded';
  const isChecking = updateState.status === 'checking';

  return (
    <div
      data-modal
      style={{ WebkitAppRegion: 'no-drag' } as any}
      className="modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-150 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{ WebkitAppRegion: 'no-drag' } as any}
        className="bg-[#161616] border border-[#2C2C2E] rounded-[10px] w-full max-w-[460px] shadow-[0_20px_45px_rgba(0,0,0,0.65),0_0_0_1px_#333336] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{ WebkitAppRegion: 'no-drag' } as any}
          className="h-[38px] px-3.5 bg-[#232326] border-b border-[#2C2C2E] flex items-center justify-between shrink-0"
        >
          {/* Segmented Control Tabs */}
          <div
            style={{ WebkitAppRegion: 'no-drag' } as any}
            className="inline-flex p-0.5 rounded-[6px] bg-[#252528] border border-[#333336] text-[11px]"
          >
            {/* General Tab */}
            <button
              type="button"
              style={{ WebkitAppRegion: 'no-drag' } as any}
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] font-medium transition-colors cursor-pointer ${
                activeTab === 'general'
                  ? 'bg-[#3A3A3E] text-white shadow-sm'
                  : 'text-[#8E8E93] hover:text-[#E5E5EA]'
              }`}
            >
              <Sliders className="w-3 h-3 text-[#007AFF]" />
              <span>{t('settings.general')}</span>
            </button>

            {/* Updates Tab */}
            <button
              type="button"
              style={{ WebkitAppRegion: 'no-drag' } as any}
              onClick={() => setActiveTab('updates')}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] font-medium transition-colors cursor-pointer ${
                activeTab === 'updates'
                  ? 'bg-[#3A3A3E] text-white shadow-sm'
                  : 'text-[#8E8E93] hover:text-[#E5E5EA]'
              }`}
            >
              <RefreshCw
                className={`w-3 h-3 text-[#007AFF] ${isChecking || isDownloading ? 'animate-spin' : ''}`}
              />
              <span>{t('settings.updates')}</span>

              {isDownloaded && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] animate-pulse" />
              )}
              {isDownloading && (
                <span className="text-[10px] font-mono text-[#007AFF] font-medium">
                  {Math.round(updateState.percent || 0)}%
                </span>
              )}
            </button>

            {/* Logs Tab */}
            <button
              type="button"
              style={{ WebkitAppRegion: 'no-drag' } as any}
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] font-medium transition-colors cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-[#3A3A3E] text-white shadow-sm'
                  : 'text-[#8E8E93] hover:text-[#E5E5EA]'
              }`}
            >
              <Terminal className="w-3 h-3 text-[#007AFF]" />
              <span>{t('settings.logs')}</span>
              {errorCount > 0 && (
                <span className="px-1.5 py-0.1 bg-[#FF453A]/20 text-[#FF453A] text-[9px] font-bold rounded-full border border-[#FF453A]/30">
                  {errorCount}
                </span>
              )}
            </button>
          </div>

          {/* Close Button */}
          <button
            type="button"
            style={{ WebkitAppRegion: 'no-drag' } as any}
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded text-[#8E8E93] hover:text-[#FFFFFF] hover:bg-[#2C2C2E] transition-colors cursor-pointer"
            title={t('window.close')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 flex flex-col gap-3.5 h-[420px] max-h-[420px] overflow-y-auto">
          {activeTab === 'general' && (
            <>
              <TargetFolderSetting
                targetFolder={targetFolder}
                onSelectFolder={onSelectFolder}
              />

              <div className="h-px bg-[#2C2C2E]" />

              <ToggleSetting
                title={t('settings.autoStart')}
                description={t('settings.autoStartDesc')}
                icon={Power}
                isActive={autoStart}
                onToggle={onToggleAutoStart}
              />

              <ToggleSetting
                title={t('settings.notifications')}
                description={t('settings.notificationsDesc')}
                icon={Bell}
                isActive={notifications}
                onToggle={onToggleNotifications}
              />

              <div className="h-px bg-[#2C2C2E]" />

              {/* Language Selection Setting */}
              <div className="flex items-center justify-between py-1 select-none">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-[6px] bg-[#202022] border border-[#2C2C2E] flex items-center justify-center text-[#8E8E93] shrink-0">
                    <Languages className="w-3.5 h-3.5 text-[#007AFF]" />
                  </div>
                  <div>
                    <div className="text-[12px] font-medium text-[#F2F2F7] leading-tight">
                      {t('settings.language')}
                    </div>
                    <div className="text-[11px] text-[#8E8E93] leading-tight mt-0.5">
                      {t('settings.languageDesc')}
                    </div>
                  </div>
                </div>

                <div className="inline-flex p-0.5 rounded-[6px] bg-[#202022] border border-[#2C2C2E] text-[11px]">
                  {availableLanguages.map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => (onSetLanguage ? onSetLanguage(item.code) : setLanguage(item.code))}
                      className={`px-2.5 py-0.5 rounded-[4px] font-medium transition-colors cursor-pointer ${
                        activeLanguage === item.code
                          ? 'bg-[#007AFF] text-white shadow-sm'
                          : 'text-[#8E8E93] hover:text-[#E5E5EA]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <UpnpStatusSection upnpStatus={upnpStatus} />

              <ConnectedDevicesSection
                pairedDevices={pairedDevices}
                onUnpairDevice={onUnpairDevice}
              />
            </>
          )}

          {activeTab === 'updates' && (
            <UpdatesSection
              updateState={updateState}
              onCheckForUpdates={onCheckForUpdates}
              onInstallUpdate={onInstallUpdate}
              platform={platform}
              appVersion={appVersion}
            />
          )}

          {activeTab === 'logs' && <LogsSection />}
        </div>
      </div>
    </div>
  );
};
