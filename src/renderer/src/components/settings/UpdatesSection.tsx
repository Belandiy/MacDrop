import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, ArrowDown, Sparkles } from 'lucide-react';
import { UpdateStateInfo } from '../../vite-env';
import logoImg from '../../assets/logo.png';

interface UpdatesSectionProps {
  updateState: UpdateStateInfo;
  onCheckForUpdates: () => Promise<void>;
  onInstallUpdate: () => void;
  platform?: string;
  appVersion: string;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 МБ';
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatSpeed(bytesPerSec?: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '';
  return `${formatBytes(bytesPerSec)}/с`;
}

export const UpdatesSection: React.FC<UpdatesSectionProps> = ({
  updateState,
  onCheckForUpdates,
  onInstallUpdate,
  platform,
  appVersion
}) => {
  const [isManualChecking, setIsManualChecking] = useState(false);

  const handleManualCheck = async () => {
    setIsManualChecking(true);
    try {
      await onCheckForUpdates();
    } finally {
      setIsManualChecking(false);
    }
  };

  const isChecking = updateState.status === 'checking' || isManualChecking;
  const isDownloading = updateState.status === 'downloading';
  const isDownloaded = updateState.status === 'downloaded';
  const isError = updateState.status === 'error';
  const isUpToDate = updateState.status === 'not-available' || (!isChecking && !isDownloading && !isDownloaded && !isError);

  const percent = Math.min(Math.max(Math.round(updateState.percent || 0), 0), 100);

  return (
    <div className="flex flex-col gap-3.5">
      {/* App & Version Info Card */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-white/10 shadow-sm bg-black/30">
            <img src={logoImg} alt="MacDrop" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-white tracking-tight">MacDrop</span>
              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                v{appVersion}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {platform === 'darwin' ? 'macOS Edition' : 'Windows Edition'}
            </p>
          </div>
        </div>

        {isUpToDate && (
          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Актуально</span>
          </span>
        )}
      </div>

      {/* Main Status Container */}
      {isDownloaded && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col gap-3 shadow-lg shadow-emerald-950/20 animate-in fade-in duration-300">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-emerald-300">
                Версия v{updateState.version} готова к установке
              </h4>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                Файлы обновления загружены на ваш компьютер. Нажмите кнопку ниже, чтобы перезагрузить приложение и применить обновление.
              </p>
            </div>
          </div>

          <button
            onClick={onInstallUpdate}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Перезагрузить и установить</span>
          </button>
        </div>
      )}

      {isDownloading && (
        <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex flex-col gap-3 shadow-lg shadow-indigo-950/20 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <ArrowDown className="w-4 h-4 animate-bounce" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-indigo-200">
                  Загрузка v{updateState.version || 'обновления'}...
                </h4>
                <p className="text-[10px] text-slate-400">
                  Скачивание в фоновом режиме
                </p>
              </div>
            </div>
            <span className="font-mono text-sm font-bold text-indigo-300 px-2 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-500/30">
              {percent}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/10">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300 ease-out shadow-[0_0_8px_rgba(99,102,241,0.5)]"
              style={{ width: `${percent}%` }}
            />
          </div>

          {/* Progress Metrics */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>
              {formatBytes(updateState.transferred)} / {formatBytes(updateState.total)}
            </span>
            {updateState.bytesPerSecond && (
              <span className="text-indigo-300">
                {formatSpeed(updateState.bytesPerSecond)}
              </span>
            )}
          </div>
        </div>
      )}

      {isChecking && (
        <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex flex-col items-center justify-center text-center gap-2">
          <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
          <div className="text-xs font-semibold text-slate-200">Поиск обновлений...</div>
          <div className="text-[11px] text-slate-400">Связываемся с GitHub Releases</div>
        </div>
      )}

      {isError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex flex-col gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-rose-300">Не удалось проверить обновления</h4>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                {updateState.error || 'Проверьте сетевое подключение и повторите попытку.'}
              </p>
            </div>
          </div>

          <button
            onClick={handleManualCheck}
            disabled={isChecking}
            className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-slate-200 hover:text-white font-medium text-xs transition-colors border border-white/[0.08] cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            <span>Повторить попытку</span>
          </button>
        </div>
      )}

      {isUpToDate && !isDownloaded && !isDownloading && !isChecking && !isError && (
        <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-200">
                У вас установлена последняя версия
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Новые обновления отсутствуют. MacDrop автоматически проверяет релизы в фоновом режиме.
              </p>
            </div>
          </div>

          <button
            onClick={handleManualCheck}
            disabled={isChecking}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-slate-200 hover:text-white font-medium text-xs transition-colors border border-white/[0.08] cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isChecking ? 'animate-spin' : ''}`} />
            <span>Проверить обновления</span>
          </button>
        </div>
      )}
    </div>
  );
};
