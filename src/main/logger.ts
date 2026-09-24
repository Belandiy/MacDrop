import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { EventEmitter } from 'events';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  tag: string;
  message: string;
  details?: string;
}

export class AppLogger extends EventEmitter {
  private static instance: AppLogger;
  private buffer: LogEntry[] = [];
  private maxBufferSize: number = 1000;
  private logDir: string;
  private logFilePath: string;
  private maxFileSizeBytes: number = 5 * 1024 * 1024; // 5 MB
  private idCounter: number = 0;

  constructor(customDir?: string) {
    super();

    try {
      if (customDir) {
        this.logDir = customDir;
      } else if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
        this.logDir = path.join(os.tmpdir(), 'macdrop-logs');
      } else if (app?.getPath) {
        this.logDir = path.join(app.getPath('userData'), 'logs');
      } else {
        this.logDir = path.join(os.homedir(), '.macdrop', 'logs');
      }
    } catch {
      this.logDir = customDir || path.join(os.homedir(), '.macdrop', 'logs');
    }

    this.logFilePath = path.join(this.logDir, 'macdrop.log');
    this.ensureDir();
  }

  public static getInstance(): AppLogger {
    if (!AppLogger.instance) {
      AppLogger.instance = new AppLogger();
    }
    return AppLogger.instance;
  }

  private ensureDir(): void {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (err) {
      console.error('[Logger] Failed to create log directory:', err);
    }
  }

  public log(level: LogLevel, tag: string, message: string, rawDetails?: any): LogEntry {
    let details: string | undefined;
    if (rawDetails !== undefined && rawDetails !== null) {
      if (rawDetails instanceof Error) {
        details = rawDetails.stack || rawDetails.message;
      } else if (typeof rawDetails === 'object') {
        try {
          details = JSON.stringify(rawDetails);
        } catch {
          details = String(rawDetails);
        }
      } else {
        details = String(rawDetails);
      }
    }

    const timestamp = Date.now();
    const id = `${timestamp}-${++this.idCounter}`;

    const entry: LogEntry = {
      id,
      timestamp,
      level,
      tag: tag.startsWith('[') ? tag : `[${tag}]`,
      message,
      ...(details ? { details } : {})
    };

    // Keep ring buffer bounded
    this.buffer.push(entry);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    // Write to persistent file
    this.appendToFile(entry);

    // Broadcast to listeners (e.g. IPC)
    this.emit('entry', entry);

    // Also mirror to stdout in dev (suppressed during unit tests)
    if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
      const timeStr = new Date(timestamp).toLocaleTimeString();
      const formattedConsole = `[${timeStr}] ${entry.tag} ${message}`;
      if (level === 'error') {
        console.error(formattedConsole, details || '');
      } else if (level === 'warn') {
        console.warn(formattedConsole, details || '');
      } else {
        console.log(formattedConsole, details || '');
      }
    }

    return entry;
  }

  public info(tag: string, message: string, details?: any): LogEntry {
    return this.log('info', tag, message, details);
  }

  public warn(tag: string, message: string, details?: any): LogEntry {
    return this.log('warn', tag, message, details);
  }

  public error(tag: string, message: string, details?: any): LogEntry {
    return this.log('error', tag, message, details);
  }

  public debug(tag: string, message: string, details?: any): LogEntry {
    return this.log('debug', tag, message, details);
  }

  public getLogs(limit?: number): LogEntry[] {
    if (limit && limit > 0) {
      return this.buffer.slice(-limit);
    }
    return [...this.buffer];
  }

  public clearLogs(): boolean {
    this.buffer = [];
    try {
      this.ensureDir();
      if (fs.existsSync(this.logFilePath)) {
        // Safe truncate for Windows/macOS without breaking open handles
        fs.truncateSync(this.logFilePath, 0);
      }
      this.emit('cleared');
      return true;
    } catch (err) {
      console.error('[Logger] Failed to truncate log file:', err);
      return false;
    }
  }

  public getLogFilePath(): string {
    return this.logFilePath;
  }

  public getLogDir(): string {
    return this.logDir;
  }

  private appendToFile(entry: LogEntry): void {
    try {
      this.ensureDir();
      this.rotateIfNeeded();

      const iso = new Date(entry.timestamp).toISOString();
      const line = `[${iso}] [${entry.level.toUpperCase()}] ${entry.tag} ${entry.message}${
        entry.details ? ' | Details: ' + entry.details : ''
      }\n`;

      fs.appendFileSync(this.logFilePath, line, 'utf8');
    } catch (err) {
      // Fallback silently to prevent logger from crashing the app
    }
  }

  private rotateIfNeeded(): void {
    try {
      if (fs.existsSync(this.logFilePath)) {
        const stats = fs.statSync(this.logFilePath);
        if (stats.size >= this.maxFileSizeBytes) {
          const backupPath = path.join(this.logDir, 'macdrop.1.log');
          try {
            if (fs.existsSync(backupPath)) {
              fs.unlinkSync(backupPath);
            }
          } catch {}
          fs.renameSync(this.logFilePath, backupPath);
        }
      }
    } catch {}
  }
}

export const logger = AppLogger.getInstance();
