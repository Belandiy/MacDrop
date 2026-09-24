import React from 'react';
import { Send, Trash2 } from 'lucide-react';

interface DeviceActionButtonsProps {
  isSending: boolean;
  handlePickAndSend: () => void;
  isConfirmingDelete: boolean;
  setIsConfirmingDelete: (isConfirming: boolean) => void;
  handleDeleteDevice: () => void;
  hideDelete?: boolean;
}

// ⚡ Bolt Performance Optimization:
// Wrapped DeviceActionButtons in React.memo to prevent unnecessary re-renders when parent App updates frequently.
export const DeviceActionButtons: React.FC<DeviceActionButtonsProps> = React.memo(({
  isSending,
  handlePickAndSend,
  isConfirmingDelete,
  setIsConfirmingDelete,
  handleDeleteDevice,
  hideDelete
}) => {
  return (
    <div className="flex items-center gap-2 pt-2">
      <button
        onClick={handlePickAndSend}
        disabled={isSending}
        className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-95 text-white font-semibold py-2 px-3 rounded-xl text-xs transition-all shadow-md shadow-indigo-600/30 disabled:opacity-50"
      >
        <Send className="w-3.5 h-3.5" />
        <span>{isSending ? 'Отправка...' : 'Отправить файл(ы)'}</span>
      </button>

      {!hideDelete && (isConfirmingDelete ? (
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleDeleteDevice}
            className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-2.5 py-2 rounded-xl font-semibold transition-colors"
          >
            Удалить связь
          </button>
          <button
            onClick={() => setIsConfirmingDelete(false)}
            className="bg-white/[0.08] hover:bg-white/[0.12] text-slate-200 text-xs px-2 py-2 rounded-xl transition-colors"
          >
            Отмена
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsConfirmingDelete(true)}
          className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/25 py-2 px-3 rounded-xl text-xs font-semibold transition-colors"
          title="Удалить связь с устройством"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Разорвать связь</span>
        </button>
      ))}
    </div>
  );
});
