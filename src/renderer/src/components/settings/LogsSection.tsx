import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Copy, Check, Trash2, FolderOpen, ChevronRight, ChevronDown, ArrowDown, FileText, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { LogEntry } from '../../vite-env';
import { useTranslation } from '../../i18n';

export const LogsSection: React.FC = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const logsEndRef = useRef<HTMLDivElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Initial fetch of ring buffer
    if (window.macdrop?.getLogs) {
      window.macdrop.getLogs().then((initialLogs) => {
        setLogs(initialLogs || []);
      }).catch(() => {});
    }

    // Real-time subscription to incoming logs
    const cleanupEntry = window.macdrop?.onLogEntry?.((newEntry) => {
      setLogs((prev) => [...prev, newEntry]);
    });

    const cleanupCleared = window.macdrop?.onLogsCleared?.(() => {
      setLogs([]);
      setExpandedIds({});
    });

    return () => {
      cleanupEntry?.();
      cleanupCleared?.();
    };
  }, []);

  // Auto-scroll on new entries if enabled
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Counts for pills
  const counts = useMemo(() => {
    let error = 0;
    let warn = 0;
    let info = 0;
    for (const log of logs) {
      if (log.level === 'error') error++;
      else if (log.level === 'warn') warn++;
      else if (log.level === 'info') info++;
    }
    return { all: logs.length, error, warn, info };
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return logs.filter((log) => {
      if (levelFilter !== 'all' && log.level !== levelFilter) {
        return false;
      }
      if (!q) return true;
      return (
        log.message.toLowerCase().includes(q) ||
        log.tag.toLowerCase().includes(q) ||
        (log.details && log.details.toLowerCase().includes(q))
      );
    });
  }, [logs, levelFilter, searchQuery]);

  const toggleDetails = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyLogs = () => {
    if (filteredLogs.length === 0) return;
    const text = filteredLogs
      .map((l) => {
        const time = new Date(l.timestamp).toISOString();
        return `[${time}] [${l.level.toUpperCase()}] ${l.tag} ${l.message}${l.details ? ' | Details: ' + l.details : ''}`;
      })
      .join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const handleClear = async () => {
    setLogs([]);
    setExpandedIds({});
    await window.macdrop?.clearLogs?.();
  };

  const handleOpenFolder = () => {
    window.macdrop?.openLogsFolder?.();
  };

  return (
    <div className="flex flex-col gap-2.5 w-full select-none">
      {/* Top Search */}
      <div className="relative w-full">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8E8E93] pointer-events-none" />
        <input
          type="text"
          placeholder={t('logs.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-black/30 border border-white/[0.08] rounded-[6px] pl-7 pr-14 py-1 text-[11px] text-[#F2F2F7] placeholder-[#636366] focus:outline-none focus:border-[#007AFF] transition-colors h-7"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#8E8E93] hover:text-white cursor-pointer"
          >
            {t('logs.clearSearch')}
          </button>
        )}
      </div>

      {/* Level Filters - Segmented style */}
      <div className="grid grid-cols-4 gap-0.5 bg-black/30 p-0.5 rounded-[6px] border border-white/[0.08] w-full shrink-0">
        <button
          onClick={() => setLevelFilter('all')}
          className={`h-6 px-1 rounded-[4px] text-[10px] font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer ${
            levelFilter === 'all'
              ? 'bg-white/[0.14] text-white shadow-sm border border-white/[0.08]'
              : 'text-[#8E8E93] hover:text-[#E5E5EA]'
          }`}
        >
          <span className="truncate">{t('logs.filterAll', { count: counts.all })}</span>
        </button>
        <button
          onClick={() => setLevelFilter('error')}
          className={`h-6 px-1 rounded-[4px] text-[10px] font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer ${
            levelFilter === 'error'
              ? 'bg-[#FF453A]/20 text-[#FF453A] shadow-sm'
              : 'text-[#8E8E93] hover:text-[#FF453A]'
          }`}
        >
          <AlertCircle className="w-3 h-3 text-[#FF453A] shrink-0" />
          <span className="truncate">{t('logs.filterError', { count: counts.error })}</span>
        </button>
        <button
          onClick={() => setLevelFilter('warn')}
          className={`h-6 px-1 rounded-[4px] text-[10px] font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer ${
            levelFilter === 'warn'
              ? 'bg-[#FFBD2E]/20 text-[#FFBD2E] shadow-sm'
              : 'text-[#8E8E93] hover:text-[#FFBD2E]'
          }`}
        >
          <AlertTriangle className="w-3 h-3 text-[#FFBD2E] shrink-0" />
          <span className="truncate">{t('logs.filterWarn', { count: counts.warn })}</span>
        </button>
        <button
          onClick={() => setLevelFilter('info')}
          className={`h-6 px-1 rounded-[4px] text-[10px] font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer ${
            levelFilter === 'info'
              ? 'bg-[#007AFF]/20 text-[#007AFF] shadow-sm'
              : 'text-[#8E8E93] hover:text-[#007AFF]'
          }`}
        >
          <Info className="w-3 h-3 text-[#007AFF] shrink-0" />
          <span className="truncate">{t('logs.filterInfo', { count: counts.info })}</span>
        </button>
      </div>

      {/* Terminal View Container - Strictly locked height */}
      <div
        ref={listContainerRef}
        className="bg-black/40 border border-white/[0.08] rounded-[8px] p-2.5 h-[265px] min-h-[265px] max-h-[265px] overflow-y-auto font-mono text-[11px] flex flex-col gap-1 shadow-inner select-text"
      >
        {filteredLogs.length === 0 ? (
          <div className="h-full flex-1 flex flex-col items-center justify-center text-center p-4 text-[#8E8E93] select-none">
            <FileText className="w-6 h-6 mb-1.5 opacity-30 text-[#007AFF]" />
            <p className="text-[11px] font-sans">
              {logs.length === 0
                ? `${t('logs.emptyTitle')}. ${t('logs.emptyDesc')}.`
                : 'Нет записей, соответствующих выбранному фильтру.'}
            </p>
          </div>
        ) : (
          filteredLogs.map((entry) => {
            const timeStr = new Date(entry.timestamp).toLocaleTimeString();
            const isExpanded = !!expandedIds[entry.id];
            const hasDetails = Boolean(entry.details);

            let badgeClass = 'bg-[#2C2C2E] text-[#D1D1D6] border-[#3A3A3C]';
            if (entry.level === 'error') {
              badgeClass = 'bg-[#FF453A]/15 text-[#FF453A] border-[#FF453A]/30';
            } else if (entry.level === 'warn') {
              badgeClass = 'bg-[#FFBD2E]/15 text-[#FFBD2E] border-[#FFBD2E]/30';
            } else if (entry.level === 'info') {
              badgeClass = 'bg-[#007AFF]/15 text-[#007AFF] border-[#007AFF]/30';
            }

            return (
              <div
                key={entry.id}
                className="flex flex-col border-b border-[#242426] pb-1 last:border-b-0"
              >
                <div className="flex items-start gap-1.5">
                  {/* Timestamp */}
                  <span className="text-[#636366] shrink-0 select-none text-[10px] leading-relaxed">
                    {timeStr}
                  </span>

                  {/* Level Badge */}
                  <span
                    className={`px-1 py-0.2 rounded-[3px] text-[8px] uppercase font-bold tracking-wider border shrink-0 select-none leading-none ${badgeClass}`}
                  >
                    {entry.level}
                  </span>

                  {/* Tag */}
                  <span className="text-[#007AFF] font-medium shrink-0 select-none text-[10px] leading-relaxed">
                    {entry.tag}
                  </span>

                  {/* Message */}
                  <span className="text-[#E5E5EA] flex-1 break-words leading-relaxed text-[11px]">
                    {entry.message}
                  </span>

                  {/* Details Toggle */}
                  {hasDetails && (
                    <button
                      onClick={() => toggleDetails(entry.id)}
                      className="p-0.5 text-[#8E8E93] hover:text-white transition-colors shrink-0 cursor-pointer"
                      title={isExpanded ? t('logs.hideDetails') : t('logs.showDetails')}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>

                {/* Collapsible Details */}
                {hasDetails && isExpanded && (
                  <div className="mt-1 ml-9 p-1.5 bg-[#18181A] border border-[#2C2C2E] rounded-[4px] text-[#AEAEB2] text-[9px] break-all whitespace-pre-wrap select-text">
                    {entry.details}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={logsEndRef} />
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between gap-2 flex-nowrap pt-0.5 w-full">
        {/* Auto-scroll */}
        <label className="flex items-center gap-1.5 cursor-pointer text-[#8E8E93] hover:text-[#E5E5EA] select-none shrink-0">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="rounded border-[#3A3A3C] bg-[#1A1A1A] text-[#007AFF] focus:ring-0 w-3.5 h-3.5"
          />
          <span className="flex items-center gap-1 text-[11px]">
            <ArrowDown className="w-3 h-3 text-[#8E8E93]" />
            {t('logs.autoScroll')}
          </span>
        </label>

        {/* Action Buttons: Copy, Folder, Clear */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Copy - Icon Only */}
          <button
            onClick={handleCopyLogs}
            disabled={filteredLogs.length === 0}
            className="w-6 h-6 rounded-[5px] bg-white/[0.08] hover:bg-white/[0.14] text-[#D1D1D6] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center justify-center cursor-pointer border border-white/[0.1]"
            title={copied ? t('logs.copied') : t('logs.copy')}
          >
            {copied ? (
              <Check className="w-3 h-3 text-[#34C759]" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>

          {/* Open Logs Folder */}
          <button
            onClick={handleOpenFolder}
            className="flex items-center gap-1 px-2 h-6 rounded-[5px] bg-white/[0.08] hover:bg-white/[0.14] text-[11px] text-[#D1D1D6] hover:text-white border border-white/[0.1] transition-colors shrink-0 cursor-pointer"
            title="Folder"
          >
            <FolderOpen className="w-3 h-3 text-[#007AFF]" />
            <span>{t('logs.openFolder')}</span>
          </button>

          {/* Clear Logs */}
          <button
            onClick={handleClear}
            disabled={logs.length === 0}
            className="flex items-center gap-1 px-2 h-6 rounded-[5px] bg-[#FF453A]/15 hover:bg-[#FF453A]/25 text-[11px] text-[#FF453A] border border-[#FF453A]/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
            title={t('logs.clear')}
          >
            <Trash2 className="w-3 h-3" />
            <span>{t('logs.clear')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
