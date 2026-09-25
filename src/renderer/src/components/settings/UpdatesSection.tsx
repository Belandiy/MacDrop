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
    <div className="flex flex-col gap-3 select-none">
      {/* App & Version Info Card */}
      <div className="flex items-center justify-between p-3 rounded-[6px] bg-[#1A1A1A] border border-[#2C2C2E]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[6px] overflow-hidden shrink-0 border border-[#2C2C2E] bg-[#202022] flex items-center justify-center">
            <img src={logoImg} alt="MacDrop" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[13px] text-[#F2F2F7] tracking-tight">MacDrop</span>
              <span className="font-mono text-[10px] font-medium px-1.5 py-0.2 rounded bg-[#2C2C2E] text-[#D1D1D6] border border-[#3A3A3C]">
                v{appVersion}
              </span>
            </div>
            <p className="text-[11px] text-[#8E8E93] mt-0.5">
              {platform === 'darwin' ? 'macOS Edition' : 'Windows Edition'}
            </p>
          </div>
        </div>

        {isUpToDate && (
          <span className="flex items-center gap-1 text-[11px] font-medium text-[#34C759] px-2 py-0.5 rounded-[4px] bg-[#34C759]/10 border border-[#34C759]/25">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Актуально</span>
          </span>
        )}
      </div>

      {/* Main Status Container */}
      {isDownloaded && (
        <div className="p-3.5 rounded-[6px] bg-[#1A1A1A] border border-[#34C759]/40 flex flex-col gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-[5px] bg-[#34C759]/15 border border-[#34C759]/30 flex items-center justify-center shrink-0 text-[#34C759]">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-[12px] font-semibold text-[#F2F2F7]">
                Версия v{updateState.version} готова к установке
              </h4>
              <p className="text-[11px] text-[#8E8E93] mt-0.5 leading-relaxed">
                Файлы обновления загружены на ваш компьютер. Нажмите кнопку ниже, чтобы перезагрузить приложение и применить обновление.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onInstallUpdate}
            className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-[5px] bg-[#007AFF] hover:bg-[#0071E3] active:bg-[#0062C4] text-white font-medium text-[12px] shadow-[0_0.5px_1px_rgba(0,0,0,0.4)] transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Перезагрузить и установить</span>
          </button>
        </div>
      )}

      {isDownloading && (
        <div className="p-3.5 rounded-[6px] bg-[#1A1A1A] border border-[#007AFF]/40 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-[5px] bg-[#007AFF]/20 border border-[#007AFF]/30 flex items-center justify-center text-[#007AFF]">
                <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
              </div>
              <div>
                <h4 className="text-[12px] font-medium text-[#F2F2F7]">
                  Загрузка v{updateState.version || 'обновления'}...
                </h4>
                <p className="text-[10px] text-[#8E8E93]">
                  Скачивание в фоновом режиме
                </p>
              </div>
            </div>
            <span className="font-mono text-[12px] font-medium text-[#007AFF] px-2 py-0.5 rounded-[4px] bg-[#007AFF]/10 border border-[#007AFF]/25">
              {percent}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-1.5 w-full bg-[#2C2C2E] rounded-[2px] overflow-hidden">
            <div
              className="h-full bg-[#007AFF] rounded-[2px] transition-all duration-300 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>

          {/* Progress Metrics */}
          <div className="flex items-center justify-between text-[10px] text-[#8E8E93] font-mono">
            <span>
              {formatBytes(updateState.transferred)} / {formatBytes(updateState.total)}
            </span>
            {updateState.bytesPerSecond && (
              <span className="text-[#007AFF]">
                {formatSpeed(updateState.bytesPerSecond)}
              </span>
            )}
          </div>
        </div>
      )}

      {isChecking && (
        <div className="p-4 rounded-[6px] bg-[#1A1A1A] border border-[#2C2C2E] flex flex-col items-center justify-center text-center gap-1.5">
          <RefreshCw className="w-4 h-4 text-[#007AFF] animate-spin" />
          <div className="text-[12px] font-medium text-[#F2F2F7]">Поиск обновлений...</div>
          <div className="text-[11px] text-[#8E8E93]">Связываемся с GitHub Releases</div>
        </div>
      )}

      {isError && (
        <div className="p-3.5 rounded-[6px] bg-[#1A1A1A] border border-[#FF453A]/30 flex flex-col gap-2.5">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[#FF453A] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-[12px] font-semibold text-[#FF453A]">Не удалось проверить обновления</h4>
              <p className="text-[11px] text-[#8E8E93] mt-0.5 leading-relaxed">
                {updateState.error || 'Проверьте сетевое подключение и повторите попытку.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleManualCheck}
            disabled={isChecking}
            className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-[5px] bg-[#2C2C2E] hover:bg-[#38383A] text-[#D1D1D6] hover:text-white font-medium text-[11px] border border-[#3A3A3C] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            <span>Повторить попытку</span>
          </button>
        </div>
      )}

      {isUpToDate && !isDownloaded && !isDownloading && !isChecking && !isError && (
        <div className="p-3.5 rounded-[6px] bg-[#1A1A1A] border border-[#2C2C2E] flex flex-col gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-[5px] bg-[#34C759]/15 border border-[#34C759]/30 flex items-center justify-center shrink-0 text-[#34C759]">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-[12px] font-medium text-[#F2F2F7]">
                У вас установлена последняя версия
              </h4>
              <p className="text-[11px] text-[#8E8E93] mt-0.5 leading-relaxed">
                Новые обновления отсутствуют. MacDrop автоматически проверяет релизы в фоновом режиме.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleManualCheck}
            disabled={isChecking}
            className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-[5px] bg-[#2C2C2E] hover:bg-[#38383A] text-[#D1D1D6] hover:text-white font-medium text-[12px] border border-[#3A3A3C] shadow-[0_0.5px_1px_rgba(0,0,0,0.4)] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#007AFF] ${isChecking ? 'animate-spin' : ''}`} />
            <span>Проверить обновления</span>
          </button>
        </div>
      )}
    </div>
  );
};
