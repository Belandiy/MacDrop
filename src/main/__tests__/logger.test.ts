import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppLogger } from '../logger';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('AppLogger', () => {
  let testLogDir: string;
  let logger: AppLogger;

  beforeEach(() => {
    testLogDir = path.join(os.tmpdir(), `macdrop-test-logs-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    logger = new AppLogger(testLogDir);
  });

  afterEach(() => {
    try {
      if (fs.existsSync(testLogDir)) {
        fs.rmSync(testLogDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it('should log messages with correct format and levels', () => {
    const infoEntry = logger.info('Engine', 'Starting server on port 8384');
    expect(infoEntry.level).toBe('info');
    expect(infoEntry.tag).toBe('[Engine]');
    expect(infoEntry.message).toBe('Starting server on port 8384');

    const warnEntry = logger.warn('Pairing', 'Authentication failed', { reason: 'bad_token' });
    expect(warnEntry.level).toBe('warn');
    expect(warnEntry.details).toContain('bad_token');

    const errorEntry = logger.error('UPnP', 'Port mapping failed', new Error('timeout'));
    expect(errorEntry.level).toBe('error');
    expect(errorEntry.details).toContain('Error: timeout');

    const logs = logger.getLogs();
    expect(logs.length).toBe(3);
    expect(logs[0].message).toBe('Starting server on port 8384');
  });

  it('should limit ring buffer capacity to maxBufferSize', () => {
    // Fill beyond capacity
    for (let i = 0; i < 1050; i++) {
      logger.info('Test', `Message ${i}`);
    }

    const logs = logger.getLogs();
    expect(logs.length).toBe(1000);
    // Oldest should have dropped off
    expect(logs[0].message).toBe('Message 50');
    expect(logs[logs.length - 1].message).toBe('Message 1049');
  });

  it('should persist logs to file and truncate when cleared', () => {
    logger.info('FileTest', 'Written to file');
    const logFile = logger.getLogFilePath();

    expect(fs.existsSync(logFile)).toBe(true);
    const content = fs.readFileSync(logFile, 'utf8');
    expect(content).toContain('[INFO] [FileTest] Written to file');

    logger.clearLogs();
    expect(logger.getLogs().length).toBe(0);

    const clearedContent = fs.readFileSync(logFile, 'utf8');
    expect(clearedContent).toBe('');
  });

  it('should emit entry events when new logs arrive', () => {
    let captured: any = null;
    logger.on('entry', (entry) => {
      captured = entry;
    });

    logger.error('Network', 'Connection dropped');
    expect(captured).not.toBeNull();
    expect(captured.message).toBe('Connection dropped');
    expect(captured.level).toBe('error');
  });
});
