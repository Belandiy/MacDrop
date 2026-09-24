import React from 'react';
import { CheckCircle2, ArrowDownCircle, ArrowUpCircle, X, RefreshCw } from 'lucide-react';
import { formatBytes, formatSpeed } from '../DeviceDetailView';

interface ActiveTransferProgressProps {
  isVisible: boolean;
  progress: any;
  isCompleted: boolean;
  isBatch: boolean;
  percent: number;
}

// ⚡ Bolt Performance Optimization:
// Wrapped ActiveTransferProgress in React.memo to prevent unnecessary re-renders when parent App updates frequently.
export const ActiveTransferProgress: React.FC<ActiveTransferProgressProps> = React.memo(({
  isVisible,
  progress,
  isCompleted,
  isBatch,
  percent
}) => {
  return (
    <div
      className={`transition-all duration-300 ease-out overflow-hidden ${
        isVisible && progress
          ? 'max-h-36 opacity-100'
          : 'max-h-0 opacity-0 pointer-events-none'
      }`}
    >
      {progress && (
        <div className="bg-[#111319]/90 border border-white/[0.08] rounded-2xl p-3 shadow-xl">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-white truncate max-w-[240px]">
              {isCompleted ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : progress.direction === 'incoming' ? (
                <ArrowDownCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <ArrowUpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
              )}
              {isBatch && !isCompleted && (
                <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-medium shrink-0">
                  {progress.currentIndex} из {progress.totalCount}
                </span>
              )}
              <span className="truncate">{progress.filename}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`font-bold font-mono ${isCompleted ? 'text-emerald-400' : 'text-cyan-400'}`}>
                {isCompleted ? '100%' : `${percent}%`}
              </span>
              {!isCompleted && (
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
              )}
            </div>
          </div>

          <div className="w-full h-2 bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isCompleted
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                  : 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 font-mono">
            <span>
              {isCompleted
                ? isBatch
                  ? `Все файлы переданы (${progress.totalCount} шт.)`
                  : 'Передача завершена'
                : isBatch && progress.batchTotalBytes
                ? `${formatBytes(progress.batchBytesTransferred || 0)} из ${formatBytes(progress.batchTotalBytes)}`
                : `${formatBytes(progress.bytesTransferred)} из ${formatBytes(progress.totalBytes)}`}
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              {isCompleted ? (
                <span className="text-emerald-400 font-sans font-medium flex items-center gap-1">
                  ✓ Завершено
                </span>
              ) : (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
                  {formatSpeed(progress.speedBps)}
                </>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});
