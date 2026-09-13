import React from 'react';
import { X, Bell, Power, Unlink, HardDrive } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  autoStart: boolean;
  notifications: boolean;
  pairedDevice?: {
    id: string;
    name: string;
    pairedAt: string;
  };
  onToggleAutoStart: (enable: boolean) => void;
  onToggleNotifications: (enable: boolean) => void;
  onUnpairDevice: () => void;
  onSelectFolder: () => void;
  targetFolder: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  autoStart,
  notifications,
  pairedDevice,
  onToggleAutoStart,
  onToggleNotifications,
  onUnpairDevice,
  onSelectFolder,
  targetFolder
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#242426] border border-white/10 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">Настройки MacDrop</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List of settings */}
        <div className="p-5 flex flex-col gap-4">
          {/* Target Folder */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
              <span>Папка для входящих файлов</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="bg-[#1c1c1e] text-xs text-zinc-300 px-3 py-2 rounded-xl border border-white/10 truncate flex-1 font-mono">
                {targetFolder}
              </div>
              <button
                onClick={onSelectFolder}
                className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs px-3 py-2 rounded-xl border border-white/10 transition-colors shrink-0"
              >
                Обзор
              </button>
            </div>
          </div>

          <div className="h-px bg-white/10" />

          {/* Autostart */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Power className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-medium text-white">Автозапуск с системой</div>
                <div className="text-[11px] text-zinc-400">Запуск в фоновом режиме</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={autoStart}
              onChange={(e) => onToggleAutoStart(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
            />
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-medium text-white">Всплывающие уведомления</div>
                <div className="text-[11px] text-zinc-400">Системные баннеры о файлах</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={notifications}
              onChange={(e) => onToggleNotifications(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
            />
          </div>

          {/* Connected Device Info */}
          {pairedDevice && (
            <>
              <div className="h-px bg-white/10" />
              <div className="flex items-center justify-between pt-1">
                <div>
                  <div className="text-xs font-medium text-white">Связанное устройство</div>
                  <div className="text-[11px] text-zinc-400 font-mono">
                    {pairedDevice.name} ({pairedDevice.id})
                  </div>
                </div>
                <button
                  onClick={onUnpairDevice}
                  className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1.5 rounded-lg border border-red-500/20 transition-colors"
                >
                  <Unlink className="w-3 h-3" />
                  <span>Отвязать</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
