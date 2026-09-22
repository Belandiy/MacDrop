import React from 'react';
import { History, ArrowDownLeft, ArrowUpRight, File } from 'lucide-react';

interface TransferItem {
  id: string;
  filename: string;
  size: number;
  timestamp: number;
  direction: 'incoming' | 'outgoing';
  status: 'completed' | 'failed';
  peerDeviceId?: string;
  peerName?: string;
}

interface RecentTransfersProps {
  items: TransferItem[];
  onOpenFile: (filename: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'только что';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  return `${hours} ч назад`;
}

// ⚡ Bolt Performance Optimization:
// Wrapped RecentTransfers in React.memo. Prevents this component (which can contain
// multiple elements and relatively expensive format calls) from re-rendering on every
// byte transferred, as `items` reference stays the same during transfer.
export const RecentTransfers: React.FC<RecentTransfersProps> = React.memo(({ items, onOpenFile }) => {
  if (items.length === 0) {
    return (
      <div className="bg-[#111319]/60 border border-white/[0.06] rounded-2xl p-4 text-center">
        <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs mb-1 font-semibold">
          <History className="w-3.5 h-3.5 text-indigo-400" />
          <span>История передач</span>
        </div>
        <p className="text-[11px] text-slate-500">Переданные файлы будут отображаться здесь</p>
      </div>
    );
  }

  return (
    <div className="bg-[#111319]/90 border border-white/[0.08] rounded-2xl p-4 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          <History className="w-3.5 h-3.5 text-indigo-400" />
          <span>Последние файлы</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">{items.length} файл(ов)</span>
      </div>

      <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => onOpenFile(item.filename)}
            className="flex items-center justify-between p-2 rounded-xl bg-[#171a23]/70 hover:bg-[#1f2330] border border-white/[0.06] hover:border-white/[0.14] transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2.5 truncate">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                item.direction === 'incoming'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                  : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/25'
              }`}>
                {item.direction === 'incoming' ? (
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                ) : (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-white truncate group-hover:text-indigo-300 transition-colors">
                  {item.filename}
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1.5 font-mono">
                  <span>{formatBytes(item.size)}</span>
                  <span>•</span>
                  <span>{timeAgo(item.timestamp)}</span>
                  {item.peerName && (
                    <>
                      <span>•</span>
                      <span className="text-slate-400 truncate max-w-[120px] font-sans">{item.peerName}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="text-slate-500 group-hover:text-slate-300 transition-colors pl-2">
              <File className="w-3.5 h-3.5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
