import React from 'react';
import { HardDrive, File, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { TransferItem, formatBytes, timeAgo } from '../DeviceDetailView';

interface TransferHistoryLogProps {
  history: TransferItem[];
  onOpenFile: (filename: string) => void;
}

// ⚡ Bolt Performance Optimization:
// Wrapped TransferHistoryLog in React.memo. Prevents this component (which renders
// a list of history items) from re-rendering on every byte transferred, as `history`
// reference stays the same during transfer while the parent `DeviceDetailView` re-renders
// due to `currentProgress` changing.
export const TransferHistoryLog: React.FC<TransferHistoryLogProps> = React.memo(({
  history,
  onOpenFile
}) => {
  return (
    <div className="bg-[#111319]/90 border border-white/[0.08] rounded-2xl p-4 shadow-xl backdrop-blur-md flex-1 flex flex-col min-h-[220px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
          <span>Журнал передач с этим устройством</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">{history.length} файл(ов)</span>
      </div>

      {history.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 space-y-2 border border-dashed border-white/[0.08] rounded-xl">
          <File className="w-8 h-8 text-slate-600 stroke-[1.5]" />
          <p className="text-xs font-semibold text-slate-400">История передач с этим устройством пуста</p>
          <p className="text-[11px] text-slate-500">
            Перетащите файлы прямо сюда или нажмите «Отправить файл(ы)»
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 overflow-y-auto max-h-56 pr-1">
          {history.map((item) => (
            <div
              key={item.id}
              onClick={() => onOpenFile(item.filename)}
              className="flex items-center justify-between p-2.5 rounded-xl bg-[#171a23]/70 hover:bg-[#1f2330] border border-white/[0.06] hover:border-white/[0.14] transition-all cursor-pointer group"
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
                    <span>{item.direction === 'incoming' ? 'Получен' : 'Отправлен'}</span>
                    <span>•</span>
                    <span>{formatBytes(item.size)}</span>
                    <span>•</span>
                    <span>{timeAgo(item.timestamp)}</span>
                  </div>
                </div>
              </div>

              <div className="text-slate-500 group-hover:text-slate-300 transition-colors pl-2">
                <File className="w-3.5 h-3.5" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
