import React from 'react';
import { Globe, CheckCircle2 } from 'lucide-react';

export interface UpnpStatus {
  active: boolean;
  externalPort?: number;
  error?: string;
  routerName?: string;
  wanIp?: string;
  publicInternetIp?: string;
  isPublicIp?: boolean;
}

interface UpnpStatusSectionProps {
  upnpStatus: UpnpStatus | null;
}

export const UpnpStatusSection: React.FC<UpnpStatusSectionProps> = ({ upnpStatus }) => {
  return (
    <div className="flex flex-col gap-2 pt-1 border-t border-white/[0.08]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-bold text-white">Удалённый доступ (UPnP)</span>
        </div>
        {upnpStatus?.active ? (
          <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5" />
            <span>Порт {upnpStatus.externalPort || 8384} открыт</span>
          </span>
        ) : (
          <span className="text-[10px] bg-white/[0.06] text-slate-400 border border-white/[0.08] px-2 py-0.5 rounded-full font-medium">
            {upnpStatus?.error || 'Поиск роутера...'}
          </span>
        )}
      </div>

      {upnpStatus?.active && (
        <div className="bg-[#111319] p-3 rounded-xl border border-white/[0.06] text-[11px] space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span>Роутер:</span>
            <span className="text-slate-200 font-semibold truncate max-w-[170px]" title={upnpStatus.routerName}>
              {upnpStatus.routerName || 'UPnP IGD'}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Внешний IP:</span>
            <span className="font-mono text-cyan-300 font-semibold">
              {upnpStatus.wanIp || upnpStatus.publicInternetIp || '—'}
            </span>
          </div>
          <div className="flex items-center justify-between pt-0.5 text-[10px]">
            <span>Тип адреса:</span>
            {upnpStatus.isPublicIp ? (
              <span className="text-emerald-400 font-semibold">🟢 Белый IP (доступен отовсюду)</span>
            ) : (
              <span className="text-amber-400 font-semibold" title="Роутер находится за NAT провайдера">
                ⚠️ Серый IP (рекомендуется Tailscale)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
