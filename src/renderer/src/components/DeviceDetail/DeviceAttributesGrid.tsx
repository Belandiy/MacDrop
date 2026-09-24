import React from 'react';
import { Copy, Check, Clock } from 'lucide-react';
import { PairedDevice } from '../DeviceDetailView';

interface DeviceAttributesGridProps {
  device: PairedDevice;
  copiedId: boolean;
  handleCopyId: () => void;
}

// ⚡ Bolt Performance Optimization:
// Wrapped DeviceAttributesGrid in React.memo to prevent unnecessary re-renders when parent App updates frequently.
export const DeviceAttributesGrid: React.FC<DeviceAttributesGridProps> = React.memo(({
  device,
  copiedId,
  handleCopyId
}) => {
  return (
    <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-white/[0.06]">
      <div className="bg-[#171a23] border border-white/[0.06] rounded-xl p-2.5">
        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold mb-0.5">
          Неизменяемое имя
        </span>
        <span className="text-xs text-slate-200 font-medium truncate block" title={device.originalName}>
          {device.originalName}
        </span>
      </div>

      <div className="bg-[#171a23] border border-white/[0.06] rounded-xl p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold mb-0.5">
            ID устройства
          </span>
          <button
            onClick={handleCopyId}
            className="text-slate-400 hover:text-white transition-colors"
            title="Скопировать ID"
          >
            {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
        <span className="text-xs font-mono text-cyan-300 font-semibold">
          {device.id}
        </span>
      </div>

      <div className="bg-[#171a23] border border-white/[0.06] rounded-xl p-2.5">
        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold mb-0.5">
          Сетевой адрес
        </span>
        <span className="text-xs font-mono text-slate-300 truncate block">
          {device.connectionMode === 'remote' && device.remoteIp
            ? `${device.remoteIp}:${device.remotePort || 8384} (WAN)`
            : `${device.ip}:${device.port || 8384} (LAN)`}
        </span>
      </div>

      <div className="bg-[#171a23] border border-white/[0.06] rounded-xl p-2.5">
        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold mb-0.5">
          Связано
        </span>
        <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
          <Clock className="w-3 h-3" />
          {new Date(device.pairedAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
});
