import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

describe('getDefaultFolder', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.resetModules();
    vi.doMock('electron', () => ({
      app: {
        getPath: vi.fn(() => '/mock/path')
      }
    }));
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    vi.doUnmock('fs');
    vi.doUnmock('os');
    vi.doUnmock('electron');
  });

  it('returns E:\\MacDrop on Windows if E:\\ exists', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });

    vi.doMock('fs', () => ({
      default: {
        existsSync: vi.fn((p) => p === 'E:\\'),
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
        readFileSync: vi.fn()
      }
    }));

    vi.doMock('os', () => ({
      default: {
        homedir: vi.fn(() => 'C:\\Users\\User')
      }
    }));

    const { getDefaultFolder } = await import('./config');
    expect(getDefaultFolder()).toBe('E:\\MacDrop');
  });

  it('returns homedir/MacDrop on Windows if E:\\ does not exist', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });

    vi.doMock('fs', () => ({
      default: {
        existsSync: vi.fn((p) => false), // E:\\ does not exist
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
        readFileSync: vi.fn()
      }
    }));

    vi.doMock('os', () => ({
      default: {
        homedir: vi.fn(() => 'C:\\Users\\User')
      }
    }));

    // We also need to mock path for accurate testing, or rely on path.join behavior for testing OS
    vi.doMock('path', () => ({
      default: {
        join: vi.fn((...args) => args.join('\\'))
      }
    }));

    const { getDefaultFolder } = await import('./config');
    expect(getDefaultFolder()).toBe('C:\\Users\\User\\MacDrop');
    vi.doUnmock('path');
  });

  it('returns homedir/MacDrop on Windows if checking E:\\ throws an error', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });

    vi.doMock('fs', () => ({
      default: {
        existsSync: vi.fn((p) => {
          if (p === 'E:\\') throw new Error('Access denied');
          return false;
        }),
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
        readFileSync: vi.fn()
      }
    }));

    vi.doMock('os', () => ({
      default: {
        homedir: vi.fn(() => 'C:\\Users\\User')
      }
    }));

    vi.doMock('path', () => ({
      default: {
        join: vi.fn((...args) => args.join('\\'))
      }
    }));

    const { getDefaultFolder } = await import('./config');
    expect(getDefaultFolder()).toBe('C:\\Users\\User\\MacDrop');
    vi.doUnmock('path');
  });

  it('returns homedir/MacDrop on macOS/Linux', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });

    vi.doMock('fs', () => ({
      default: {
        existsSync: vi.fn(() => false),
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
        readFileSync: vi.fn()
      }
    }));

    vi.doMock('os', () => ({
      default: {
        homedir: vi.fn(() => '/Users/MacUser')
      }
    }));

    vi.doMock('path', () => ({
      default: {
        join: vi.fn((...args) => args.join('/'))
      }
    }));

    const { getDefaultFolder } = await import('./config');
    expect(getDefaultFolder()).toBe('/Users/MacUser/MacDrop');
    vi.doUnmock('path');
  });
});
