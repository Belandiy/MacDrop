import React from 'react';
import { History, ArrowDownLeft, ArrowUpRight, File } from 'lucide-react';

interface TransferItem {
  id: string;
  filename: string;
  size: number;
  timestamp: number;
  direction: 'incoming' | 'outgoing';
  status: 'completed' | 'failed';
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

export const RecentTransfers: React.FC<RecentTransfersProps> = ({ items, onOpenFile }) => {
  if (items.length === 0) {
    return (
      <div className="bg-[#2c2c2e]/60 border border-white/5 rounded-2xl p-4 text-center">
        <div className="flex items-center justify-center gap-1.5 text-zinc-500 text-xs mb-1">
          <History className="w-3.5 h-3.5" />
          <span>История передач</span>
        </div>
        <p className="text-[11px] text-zinc-400">Переданные файлы будут отображаться здесь</p>
      </div>
    );
  }

  return (
    <div className="bg-[#2c2c2e]/90 border border-white/10 rounded-2xl p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
          <History className="w-3.5 h-3.5 text-zinc-400" />
          <span>Последние файлы</span>
        </div>
        <span className="text-[10px] text-zinc-400">{items.length} файл(ов)</span>
      </div>

      <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => onOpenFile(item.filename)}
            className="flex items-center justify-between p-2 rounded-xl bg-[#1c1c1e]/80 hover:bg-[#1c1c1e] border border-white/5 hover:border-white/15 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2.5 truncate">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                item.direction === 'incoming'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-blue-500/10 text-blue-400'
              }`}>
                {item.direction === 'incoming' ? (
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                ) : (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="truncate">
                <div className="text-xs font-medium text-white truncate group-hover:text-blue-400 transition-colors">
                  {item.filename}
                </div>
                <div className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                  <span>{formatBytes(item.size)}</span>
                  <span>•</span>
                  <span>{timeAgo(item.timestamp)}</span>
                </div>
              </div>
            </div>

            <div className="text-zinc-600 group-hover:text-zinc-400 transition-colors pl-2">
              <File className="w-3.5 h-3.5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
