import React from 'react';
import { Wifi, ArrowDownCircle, ArrowUpCircle, CheckCircle2, RefreshCw } from 'lucide-react';

interface StatusCardProps {
  isConnected: boolean;
  pairedDevice?: {
    id: string;
    name: string;
    pairedAt: string;
  };
  currentProgress?: {
    filename: string;
    bytesTransferred: number;
    totalBytes: number;
    speedBps: number;
    direction: 'incoming' | 'outgoing';
  } | null;
  onOpenPairing: () => void;
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

export const StatusCard: React.FC<StatusCardProps> = ({
  isConnected,
  pairedDevice,
  currentProgress,
  onOpenPairing
}) => {
  const percent = currentProgress && currentProgress.totalBytes > 0
    ? Math.min(100, Math.round((currentProgress.bytesTransferred / currentProgress.totalBytes) * 100))
    : 0;

  return (
    <div className="bg-[#2c2c2e]/90 border border-white/10 rounded-2xl p-4 shadow-lg transition-all">
      {/* Peer device connection info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isConnected
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-zinc-700/30 text-zinc-400 border border-zinc-700'
            }`}>
              <Wifi className="w-5 h-5" />
            </div>
            <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#2c2c2e] ${
              isConnected ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-zinc-500'
            }`} />
          </div>

          <div>
            <div className="text-sm font-medium text-white flex items-center gap-1.5">
              {isConnected ? (
                <>
                  <span>{pairedDevice?.name || 'Второе устройство'}</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </>
              ) : (
                <span className="text-zinc-300">Ожидание подключения...</span>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              {isConnected
                ? 'Готов к мгновенной передаче'
                : 'Устройства связываются через QR/Код'}
            </p>
          </div>
        </div>

        {!isConnected && (
          <button
            onClick={onOpenPairing}
            className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium px-3 py-1.5 rounded-lg shadow-sm transition-colors"
          >
            Связать
          </button>
        )}
      </div>

      {/* Live sync progress if active */}
      {currentProgress && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <div className="flex items-center gap-1.5 font-medium text-white truncate max-w-[240px]">
              {currentProgress.direction === 'incoming' ? (
                <ArrowDownCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <ArrowUpCircle className="w-4 h-4 text-blue-400 shrink-0" />
              )}
              <span className="truncate">{currentProgress.filename}</span>
            </div>
            <span className="text-blue-400 font-semibold">{percent}%</span>
          </div>

          {/* Progress bar */}
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
