import React, { useState, useEffect } from 'react';
import { X, Bell, Power, Unlink, HardDrive, Globe, CheckCircle2 } from 'lucide-react';

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
  const [upnpStatus, setUpnpStatus] = useState<any>(null);

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
          {/* Target Folder */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-slate-400" />
              <span>Папка для входящих файлов</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="bg-[#111319] text-xs text-slate-200 px-3 py-2 rounded-xl border border-white/[0.08] truncate flex-1 font-mono">
                {targetFolder}
              </div>
              <button
                onClick={onSelectFolder}
                className="bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 text-white text-xs font-semibold px-3 py-2 rounded-xl border border-white/[0.08] transition-all shrink-0"
              >
                Обзор
              </button>
            </div>
          </div>

          <div className="h-px bg-white/[0.08]" />

          {/* Autostart */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center border border-indigo-500/25">
                <Power className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Автозапуск с системой</div>
                <div className="text-[11px] text-slate-400">Запуск в фоновом режиме</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onToggleAutoStart(!autoStart)}
              className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                autoStart ? 'bg-indigo-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform shadow-md ${
                  autoStart ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-violet-500/15 text-violet-300 flex items-center justify-center border border-violet-500/25">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Всплывающие уведомления</div>
                <div className="text-[11px] text-slate-400">Системные баннеры о файлах</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onToggleNotifications(!notifications)}
              className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                notifications ? 'bg-indigo-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform shadow-md ${
                  notifications ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* UPnP Remote Access Status */}
          <div className="flex flex-col gap-2 pt-1 border-t border-white/[0.08]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-bold text-white">Удалённый доступ (UPnP)</span>
              </div>
              {upnpStatus?.active ? (
                <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  <span>Порт {upnpStatus.externalPort || 8384} открыт</span>
                </span>
              ) : (
                <span className="text-[10px] bg-white/[0.06] text-slate-400 border border-white/[0.08] px-2 py-0.5 rounded-full font-medium">
                  {upnpStatus?.error || 'Поиск роутера...'}
                </span>
              )}
            </div>

            {upnpStatus?.active && (
              <div className="bg-[#111319] p-3 rounded-xl border border-white/[0.06] text-[11px] space-y-1.5">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Роутер:</span>
                  <span className="text-slate-200 font-semibold truncate max-w-[170px]" title={upnpStatus.routerName}>
                    {upnpStatus.routerName || 'UPnP IGD'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Внешний IP:</span>
                  <span className="font-mono text-cyan-300 font-semibold">
                    {upnpStatus.wanIp || upnpStatus.publicInternetIp || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-0.5 text-[10px]">
                  <span>Тип адреса:</span>
                  {upnpStatus.isPublicIp ? (
                    <span className="text-emerald-400 font-semibold">🟢 Белый IP (доступен отовсюду)</span>
                  ) : (
                    <span className="text-amber-400 font-semibold" title="Роутер находится за NAT провайдера">
                      ⚠️ Серый IP (рекомендуется Tailscale)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Connected Devices Info */}
          {pairedDevices.length > 0 && (
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
          )}
        </div>
      </div>
    </div>
  );
};
