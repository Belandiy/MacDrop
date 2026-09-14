import React from 'react';
import {
  Laptop,
  Monitor,
  Plus,
  ChevronRight,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Wifi,
  Send,
  Globe,
  X
} from 'lucide-react';
import { PairedDevice } from './DeviceDetailView';

interface DeviceListProps {
  devices: PairedDevice[];
  onSelectDevice: (device: PairedDevice) => void;
  onOpenPairing: () => void;
  onQuickSend?: (deviceId: string) => void;
  currentProgress?: {
    filename: string;
    bytesTransferred: number;
    totalBytes: number;
    speedBps: number;
    direction: 'incoming' | 'outgoing';
    peerDeviceId?: string;
    peerName?: string;
  } | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatSpeed(bps: number): string {
  return `${formatBytes(bps)}/с`;
}

export const DeviceList: React.FC<DeviceListProps> = ({
  devices,
  onSelectDevice,
  onOpenPairing,
  onQuickSend,
  currentProgress
}) => {
  const percent =
    currentProgress && currentProgress.totalBytes > 0
      ? Math.min(100, Math.round((currentProgress.bytesTransferred / currentProgress.totalBytes) * 100))
      : 0;

  return (
    <div className="bg-[#111319]/90 border border-white/[0.08] rounded-2xl p-4 shadow-xl backdrop-blur-md transition-all space-y-3">
      {/* Header with Title and Add Device button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Подключенные устройства ({devices.length})
          </h3>
        </div>

        <button
          onClick={onOpenPairing}
          className="flex items-center gap-1 text-xs bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-95 text-white font-semibold px-2.5 py-1 rounded-lg shadow-sm shadow-indigo-600/30 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Связать</span>
        </button>
      </div>

      {/* Device List or Empty State */}
      {devices.length === 0 ? (
        <div className="bg-[#171a23]/60 border border-white/[0.06] rounded-xl p-4 text-center space-y-2">
          <div className="w-10 h-10 mx-auto rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Wifi className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-200">Нет связанных устройств</p>
            <p className="text-[11px] text-slate-400">
              Нажмите «Связать», чтобы подключить Mac или Windows через код / QR
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {devices.map((device) => {
            const isMac = device.id.startsWith('MAC') || device.originalName.toLowerCase().includes('mac');
            return (
              <div
                key={device.id}
                onClick={() => onSelectDevice(device)}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[#171a23]/70 hover:bg-[#1f2330] border border-white/[0.06] hover:border-white/[0.14] transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3 truncate">
                  {/* Icon with online indicator */}
                  <div className="relative shrink-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      isMac
                        ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                        : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                    }`}>
                      {isMac ? <Laptop className="w-4.5 h-4.5" /> : <Monitor className="w-4.5 h-4.5" />}
                    </div>
                    {device.connectionMode === 'remote' ? (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#171a23] bg-cyan-500 shadow-sm shadow-cyan-500/50 flex items-center justify-center" title="В сети (Удалённо через Интернет)">
                        <Globe className="w-2 h-2 text-white" />
                      </span>
                    ) : device.connectionMode === 'offline' ? (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#171a23] bg-slate-500 shadow-sm" title="Не в сети" />
                    ) : (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#171a23] bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]" title="В сети (Wi-Fi)" />
                    )}
                  </div>

                  {/* Device Names */}
                  <div className="truncate">
                    <div className="text-xs font-semibold text-white group-hover:text-indigo-300 transition-colors flex items-center gap-1.5 truncate">
                      <span>{device.customName || device.originalName}</span>
                      {device.receiveEnabled === false && (
                        <span className="text-[9px] bg-rose-500/15 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded font-medium shrink-0">
                          Приём выкл
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 truncate">
                      <span className="truncate" title={device.originalName}>{device.originalName}</span>
                      <span>•</span>
                      <span className="font-mono text-slate-400">{device.id}</span>
                      {device.connectionMode === 'remote' && (
                        <>
                          <span>•</span>
                          <span className="text-[9px] text-cyan-300 bg-cyan-500/15 px-1.5 py-0.5 rounded border border-cyan-500/25 font-medium">Удалённо</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side actions / arrow */}
                <div className="flex items-center gap-2 pl-2 shrink-0">
                  {onQuickSend && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickSend(device.id);
                      }}
                      title="Отправить файл"
                      className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white transition-colors"
                    >
                      <Send className="w-3 h-3" />
                    </button>
                  )}
                  <div className="text-slate-500 group-hover:text-slate-300 transition-colors flex items-center gap-0.5 text-[11px]">
                    <span className="hidden group-hover:inline text-[10px] text-slate-400">Открыть</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active Transfer Progress Bar */}
      {currentProgress && (
        <div className="mt-3 pt-3 border-t border-white/[0.08]">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-white truncate max-w-[240px]">
              {currentProgress.direction === 'incoming' ? (
                <ArrowDownCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <ArrowUpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
              )}
              <span className="truncate">{currentProgress.filename}</span>
              {currentProgress.peerName && (
                <span className="text-[10px] text-slate-400 truncate">
                  ({currentProgress.direction === 'incoming' ? 'от' : 'для'} {currentProgress.peerName})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-bold font-mono">{percent}%</span>
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  if (window.macdrop?.cancelTransfer) {
                    await window.macdrop.cancelTransfer();
                  }
                }}
                title="Отменить передачу"
                className="px-1.5 py-0.5 rounded-md bg-rose-500/15 hover:bg-rose-500/25 active:bg-rose-500/40 text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1 text-[10px] font-medium"
              >
                <X className="w-3 h-3" />
                <span>Отмена</span>
              </button>
            </div>
          </div>

          <div className="w-full h-2 bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-400 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.4)] transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 font-mono">
            <span>
              {formatBytes(currentProgress.bytesTransferred)} из {formatBytes(currentProgress.totalBytes)}
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
              {formatSpeed(currentProgress.speedBps)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
