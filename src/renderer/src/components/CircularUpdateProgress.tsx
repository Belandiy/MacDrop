import React from 'react';
import { ArrowDown, RefreshCw } from 'lucide-react';
import { UpdateStateInfo } from '../vite-env';

interface CircularUpdateProgressProps {
  updateState: UpdateStateInfo;
  onOpenUpdatesSettings: () => void;
  onInstallUpdate: () => void;
}

export const CircularUpdateProgress: React.FC<CircularUpdateProgressProps> = ({
  updateState,
  onOpenUpdatesSettings,
  onInstallUpdate
}) => {
  const isDownloading = updateState.status === 'downloading';
  const isDownloaded = updateState.status === 'downloaded';

  if (!isDownloading && !isDownloaded) {
    return null;
  }

  const rawPercent = isDownloaded ? 100 : (updateState.percent || 0);
  const percent = Math.min(Math.max(rawPercent, 0), 100);

  // SVG circle calculations
  const size = 28;
  const strokeWidth = 2.5;
  const radius = 10.5;
  const circumference = 2 * Math.PI * radius; // ~65.97
  // Rotating SVG by -90deg causes the stroke to start at 12 o'clock and fill clockwise
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDownloaded) {
      onInstallUpdate();
    } else {
      onOpenUpdatesSettings();
    }
  };

  const title = isDownloaded
    ? `Обновление v${updateState.version || ''} готово. Нажмите для перезагрузки и установки.`
    : `Загрузка обновления: ${Math.round(percent)}% (нажмите для подробностей)`;

  return (
    <button
      onClick={handleClick}
      title={title}
      style={{ WebkitAppRegion: 'no-drag' } as any}
      className={`relative w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer group ${
        isDownloaded
          ? 'bg-emerald-500/15 hover:bg-emerald-500/25 shadow-[0_0_10px_rgba(16,185,129,0.35)]'
          : 'hover:bg-white/[0.08]'
      }`}
    >
      {/* Clockwise circular progress SVG */}
      <svg
        className="w-7 h-7 -rotate-90 absolute inset-0 pointer-events-none"
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Subtle background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isDownloaded ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.12)'}
          strokeWidth={strokeWidth}
        />
        {/* Foreground progress circle filling clockwise */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isDownloaded ? '#10b981' : '#6366f1'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-[stroke-dashoffset] duration-300 ease-out"
        />
      </svg>

      {/* Center Icon */}
      {isDownloaded ? (
        <RefreshCw className="w-3 h-3 text-emerald-400 group-hover:rotate-180 transition-transform duration-500" />
      ) : (
        <ArrowDown className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
      )}
    </button>
  );
};
