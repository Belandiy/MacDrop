import React from 'react';
import { Globe, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../../i18n';

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
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2 pt-1 border-t border-[#2C2C2E] select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-[#007AFF]" />
          <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider">{t('settings.upnpTitle')}</span>
        </div>
        {upnpStatus?.active ? (
          <span className="text-[10px] bg-[#34C759]/15 text-[#34C759] border border-[#34C759]/30 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5" />
            <span>{t('settings.portOpened', { port: upnpStatus.externalPort || 8384 })}</span>
          </span>
        ) : (
          <span className="text-[10px] bg-[#2C2C2E] text-[#8E8E93] border border-[#3A3A3C] px-2 py-0.5 rounded-full font-medium">
            {upnpStatus?.error || t('settings.searchingRouter')}
          </span>
        )}
      </div>

      {upnpStatus?.active && (
        <div className="bg-[#1A1A1A] p-2.5 rounded-[6px] border border-[#2C2C2E] text-[11px] space-y-1">
          <div className="flex items-center justify-between text-[#8E8E93]">
            <span>{t('settings.router')}</span>
            <span className="text-[#F2F2F7] font-medium truncate max-w-[170px]" title={upnpStatus.routerName}>
              {upnpStatus.routerName || 'UPnP IGD'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[#8E8E93]">
            <span>{t('settings.externalIp')}</span>
            <span className="font-mono text-[#007AFF] font-medium">
              {upnpStatus.wanIp || upnpStatus.publicInternetIp || '—'}
            </span>
          </div>
          <div className="flex items-center justify-between pt-0.5 text-[10px]">
            <span className="text-[#8E8E93]">{t('settings.addressType')}</span>
            {upnpStatus.isPublicIp ? (
              <span className="text-[#34C759] font-medium">{t('settings.publicIp')}</span>
            ) : (
              <span className="text-[#FFBD2E] font-medium" title="Carrier NAT">
                {t('settings.cgnatIp')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
