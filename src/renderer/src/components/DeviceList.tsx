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
  Send
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
    <div className="bg-[#2c2c2e]/90 border border-white/10 rounded-2xl p-4 shadow-lg transition-all space-y-3">
      {/* Header with Title and Add Device button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-400" />
          <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            Подключенные устройства ({devices.length})
          </h3>
        </div>

        <button
          onClick={onOpenPairing}
          className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium px-2.5 py-1 rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Связать</span>
        </button>
      </div>

      {/* Device List or Empty State */}
      {devices.length === 0 ? (
        <div className="bg-[#1c1c1e]/60 border border-white/5 rounded-xl p-4 text-center space-y-2">
          <div className="w-10 h-10 mx-auto rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
            <Wifi className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-300">Нет связанных устройств</p>
            <p className="text-[11px] text-zinc-500">
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
                className="flex items-center justify-between p-2.5 rounded-xl bg-[#1c1c1e]/70 hover:bg-[#1c1c1e] border border-white/5 hover:border-white/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3 truncate">
                  {/* Icon with online indicator */}
                  <div className="relative shrink-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      isMac
                        ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                        : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                    }`}>
                      {isMac ? <Laptop className="w-4.5 h-4.5" /> : <Monitor className="w-4.5 h-4.5" />}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#1c1c1e] bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                  </div>

                  {/* Device Names */}
                  <div className="truncate">
                    <div className="text-xs font-semibold text-white group-hover:text-blue-400 transition-colors flex items-center gap-1.5 truncate">
                      <span>{device.customName || device.originalName}</span>
                      {device.receiveEnabled === false && (
                        <span className="text-[9px] bg-red-500/15 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-medium shrink-0">
                          Приём выкл
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-400 flex items-center gap-1.5 truncate">
                      <span className="truncate" title={device.originalName}>{device.originalName}</span>
                      <span>•</span>
                      <span className="font-mono text-zinc-500">{device.id}</span>
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
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                    >
                      <Send className="w-3 h-3" />
                    </button>
                  )}
                  <div className="text-zinc-600 group-hover:text-zinc-300 transition-colors flex items-center gap-0.5 text-[11px]">
                    <span className="hidden group-hover:inline text-[10px] text-zinc-400">Открыть</span>
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
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <div className="flex items-center gap-1.5 font-medium text-white truncate max-w-[240px]">
              {currentProgress.direction === 'incoming' ? (
                <ArrowDownCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <ArrowUpCircle className="w-4 h-4 text-blue-400 shrink-0" />
              )}
              <span className="truncate">{currentProgress.filename}</span>
              {currentProgress.peerName && (
                <span className="text-[10px] text-zinc-400 truncate">
                  ({currentProgress.direction === 'incoming' ? 'от' : 'для'} {currentProgress.peerName})
                </span>
              )}
            </div>
            <span className="text-blue-400 font-semibold">{percent}%</span>
          </div>

          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1.5">
            <span>
              {formatBytes(currentProgress.bytesTransferred)} из {formatBytes(currentProgress.totalBytes)}
            </span>
            <span className="flex items-center gap-1 text-zinc-300">
              <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
              {formatSpeed(currentProgress.speedBps)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
