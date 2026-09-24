import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Copy, Check, Trash2, FolderOpen, ChevronRight, ChevronDown, ArrowDown, FileText, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { LogEntry } from '../../vite-env';

export const LogsSection: React.FC = () => {
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

  const handleClear = () => {
    window.macdrop?.clearLogs?.();
  };

  const handleOpenFolder = () => {
    window.macdrop?.openLogsFolder?.();
  };

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* Top Search */}
      <div className="relative w-full">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Поиск по событиям и тегам..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#0d0f15] border border-white/[0.08] rounded-xl pl-8 pr-16 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors h-8"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-white"
          >
            Очистить
          </button>
        )}
      </div>

      {/* Level Filters - Fixed 4-column grid with invariant button heights and borders */}
      <div className="grid grid-cols-4 gap-1 bg-[#0d0f15] p-1 rounded-xl border border-white/[0.08] w-full shrink-0">
        <button
          onClick={() => setLevelFilter('all')}
          className={`h-7 px-1 rounded-lg text-[10px] font-medium transition-colors border flex items-center justify-center gap-1 ${
            levelFilter === 'all'
              ? 'bg-white/10 text-white border-white/10 shadow-sm'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <span className="truncate">Все ({counts.all})</span>
        </button>
        <button
          onClick={() => setLevelFilter('error')}
          className={`h-7 px-1 rounded-lg text-[10px] font-medium transition-colors border flex items-center justify-center gap-1 ${
            levelFilter === 'error'
              ? 'bg-red-500/20 text-red-300 border-red-500/30'
              : 'border-transparent text-slate-400 hover:text-red-400'
          }`}
        >
          <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
          <span className="truncate">Ошибки ({counts.error})</span>
        </button>
        <button
          onClick={() => setLevelFilter('warn')}
          className={`h-7 px-1 rounded-lg text-[10px] font-medium transition-colors border flex items-center justify-center gap-1 ${
            levelFilter === 'warn'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              : 'border-transparent text-slate-400 hover:text-amber-400'
          }`}
        >
          <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
          <span className="truncate">Варн ({counts.warn})</span>
        </button>
        <button
          onClick={() => setLevelFilter('info')}
          className={`h-7 px-1 rounded-lg text-[10px] font-medium transition-colors border flex items-center justify-center gap-1 ${
            levelFilter === 'info'
              ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
              : 'border-transparent text-slate-400 hover:text-sky-400'
          }`}
        >
          <Info className="w-3 h-3 text-sky-400 shrink-0" />
          <span className="truncate">Инфо ({counts.info})</span>
        </button>
      </div>

      {/* Terminal View Container - Strictly locked height */}
      <div
        ref={listContainerRef}
        className="bg-[#0b0c10] border border-white/[0.08] rounded-2xl p-2.5 h-[265px] min-h-[265px] max-h-[265px] overflow-y-auto font-mono text-[11px] flex flex-col gap-1.5 shadow-inner select-text"
      >
        {filteredLogs.length === 0 ? (
          <div className="h-full flex-1 flex flex-col items-center justify-center text-center p-4 text-slate-500 select-none">
            <FileText className="w-7 h-7 mb-1.5 opacity-30 text-indigo-400" />
            <p className="text-xs font-sans">
              {logs.length === 0
                ? 'Журнал пуст. События MacDrop будут появляться здесь в реальном времени.'
                : 'Нет записей, соответствующих выбранному фильтру.'}
            </p>
          </div>
        ) : (
          filteredLogs.map((entry) => {
            const timeStr = new Date(entry.timestamp).toLocaleTimeString();
            const isExpanded = !!expandedIds[entry.id];
            const hasDetails = Boolean(entry.details);

            let badgeClass = 'bg-slate-800 text-slate-300 border-slate-700';
            if (entry.level === 'error') {
              badgeClass = 'bg-red-500/15 text-red-400 border-red-500/30';
            } else if (entry.level === 'warn') {
              badgeClass = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
            } else if (entry.level === 'info') {
              badgeClass = 'bg-sky-500/15 text-sky-400 border-sky-500/30';
            }

            return (
              <div
                key={entry.id}
                className="flex flex-col border-b border-white/[0.03] pb-1.5 last:border-b-0"
              >
                <div className="flex items-start gap-1.5">
                  {/* Timestamp */}
                  <span className="text-slate-500 shrink-0 select-none text-[10px] leading-relaxed">
                    {timeStr}
                  </span>

                  {/* Level Badge */}
                  <span
                    className={`px-1 py-0.5 rounded text-[8px] uppercase font-bold tracking-wider border shrink-0 select-none leading-none ${badgeClass}`}
                  >
                    {entry.level}
                  </span>

                  {/* Tag */}
                  <span className="text-indigo-400/90 font-medium shrink-0 select-none text-[10px] leading-relaxed">
                    {entry.tag}
                  </span>

                  {/* Message */}
                  <span className="text-slate-200 break-all flex-1 text-[10px] leading-relaxed">
                    {entry.message}
                  </span>

                  {/* Details Toggle Button */}
                  {hasDetails && (
                    <button
                      onClick={() => toggleDetails(entry.id)}
                      className="text-slate-400 hover:text-white p-0.5 rounded transition-colors shrink-0"
                      title={isExpanded ? 'Скрыть детали' : 'Показать детали'}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>

                {/* Collapsible Details */}
                {hasDetails && isExpanded && (
                  <div className="mt-1 ml-10 p-2 bg-black/50 border border-white/[0.06] rounded-lg text-slate-300 text-[9px] break-all whitespace-pre-wrap select-text">
                    {entry.details}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={logsEndRef} />
      </div>

      {/* Footer Actions - Compact single row, icon-only copy button */}
      <div className="flex items-center justify-between gap-2 flex-nowrap pt-0.5 w-full">
        {/* Auto-scroll */}
        <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-300 select-none shrink-0">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-0 w-3.5 h-3.5"
          />
          <span className="flex items-center gap-1 text-[11px]">
            <ArrowDown className="w-3 h-3 text-slate-500" />
            Автопрокрутка
          </span>
        </label>

        {/* Action Buttons: Copy (icon-only), Folder, Clear */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Copy - Icon Only */}
          <button
            onClick={handleCopyLogs}
            disabled={filteredLogs.length === 0}
            className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center justify-center"
            title={copied ? 'Скопировано в буфер обмена!' : 'Скопировать журнал'}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Open Logs Folder */}
          <button
            onClick={handleOpenFolder}
            className="flex items-center gap-1 px-2 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs text-slate-300 hover:text-white transition-colors shrink-0"
            title="Открыть папку с логами в проводнике/Finder"
          >
            <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px]">Папка</span>
          </button>

          {/* Clear Logs */}
          <button
            onClick={handleClear}
            disabled={logs.length === 0}
            className="flex items-center gap-1 px-2 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs text-red-300 hover:text-red-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            title="Очистить текущие логи"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="text-[11px]">Очистить</span>
          </button>
        </div>
      </div>
    </div>
  );
};
