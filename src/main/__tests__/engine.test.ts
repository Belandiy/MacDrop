import { describe, it, expect, vi, afterEach } from 'vitest';
import { getSafeResolvedPath, getNonConflictingPath } from '../engine';
import path from 'path';
import fs from 'fs';

describe('getSafeResolvedPath', () => {
  const baseFolder = path.resolve('/test/base');

  it('should return null if sanitized filename is empty', () => {
    // A filename of just spaces will be trimmed to empty string
    expect(getSafeResolvedPath(baseFolder, '', ' ')).toBeNull();
  });

  it('should return null if sanitized filename is "." or ".."', () => {
    expect(getSafeResolvedPath(baseFolder, '', '.')).toBeNull();
    expect(getSafeResolvedPath(baseFolder, '', '..')).toBeNull();
  });

  it('should resolve a simple file correctly', () => {
    const result = getSafeResolvedPath(baseFolder, '', 'test.txt');
    expect(result).toBe(path.resolve(baseFolder, 'test.txt'));
  });

  it('should handle nested relative paths securely', () => {
    const result = getSafeResolvedPath(baseFolder, 'folder1/folder2/test.txt', 'test.txt');
    expect(result).toBe(path.resolve(baseFolder, 'folder1/folder2/test.txt'));
  });

  it('should clamp path traversal attempts (../) to be inside the baseFolder', () => {
    // Instead of failing, the function strips leading `../` and resolves it inside the base folder
    const result = getSafeResolvedPath(baseFolder, '../../../etc/passwd', 'passwd');
    expect(result).toBe(path.resolve(baseFolder, 'etc/passwd'));

    const result2 = getSafeResolvedPath(baseFolder, 'a/../../../../etc/passwd', 'passwd');
    expect(result2).toBe(path.resolve(baseFolder, 'etc/passwd'));
  });

  it('should clamp absolute paths to be resolved inside the baseFolder', () => {
    // Leading slashes are replaced, so it is treated as relative to baseFolder
    const result = getSafeResolvedPath(baseFolder, '/etc/passwd', 'passwd');
    expect(result).toBe(path.resolve(baseFolder, 'etc/passwd'));
  });

  it('should sanitize invalid characters in the filename', () => {
    const result = getSafeResolvedPath(baseFolder, '', 'file:name?.txt');
    expect(result).toBe(path.resolve(baseFolder, 'file_name_.txt'));
  });

  it('should fallback to sanitized filename if relPath is empty', () => {
    const result = getSafeResolvedPath(baseFolder, '', 'some/file:name.txt');
    expect(result).toBe(path.resolve(baseFolder, 'file_name.txt'));
  });

  it('should allow path that resolves exactly to the base folder (targetResolved === targetBase logic check)', () => {
    // If cleanRel becomes '.' (e.g., if relPath is '.'), targetResolved becomes targetBase
    // In that case targetResolved.startsWith(targetBase + path.sep) is false, but targetResolved === targetBase is true
    // Note: sanitized filename can't be '.' so relPath must be '.'
    const result = getSafeResolvedPath(baseFolder, '.', 'valid.txt');
    expect(result).toBe(baseFolder);
  });

  it('should handle Windows-style slashes in paths', () => {
    const result = getSafeResolvedPath(baseFolder, '..\\..\\Windows\\System32\\cmd.exe', 'cmd.exe');
    // On POSIX, backslashes are treated as regular characters in the normalized string
    // path.normalize doesn't convert \ to / on POSIX, but the regex `replace(/^(\.\.[\/\\])+/, '')` does handle `..\`
    expect(result).toBe(path.resolve(baseFolder, 'Windows\\System32\\cmd.exe'));
  });

  it('should return null if resolved path somehow escapes base folder', () => {
    // We can simulate an escape by passing a baseFolder that is a substring of another folder
    // e.g., baseFolder = '/test/base', targetResolved = '/test/base2/file.txt'
    // This tests the exact match / prefix logic
    const baseDir = '/test/base';
    // To get `targetResolved` = '/test/base2/file.txt' we'd need cleanRel to traverse up and then into base2.
    // Let's mock path.resolve temporarily for this specific case.
    const originalResolve = path.resolve;
    vi.spyOn(path, 'resolve').mockImplementation((...args: string[]) => {
      if (args.length === 2 && args[1] === 'malicious_path') {
        return '/test/base2/file.txt'; // escapes '/test/base'
      }
      return originalResolve(...args);
    });

    const result = getSafeResolvedPath('/test/base', 'malicious_path', 'file.txt');
    expect(result).toBeNull();

    vi.restoreAllMocks();
  });
});

describe('getNonConflictingPath', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return targetPath if it does not exist', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const target = '/fake/dir/file.txt';
    const result = getNonConflictingPath(target);

    expect(result).toBe(target);
  });

  it('should append (1) if the targetPath already exists', () => {
    const target = '/fake/dir/file.txt';

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === target);

    const result = getNonConflictingPath(target);

    expect(result).toBe(path.join('/fake/dir', 'file (1).txt'));
  });

  it('should append next available number if multiple suffixes exist', () => {
    const target = '/fake/dir/file.txt';
    const firstSuffix = path.join('/fake/dir', 'file (1).txt');
    const secondSuffix = path.join('/fake/dir', 'file (2).txt');

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      if (p === target) return true;
      if (p === firstSuffix) return true;
      if (p === secondSuffix) return true;
      return false;
    });

    const result = getNonConflictingPath(target);

    expect(result).toBe(path.join('/fake/dir', 'file (3).txt'));
  });

  it('should handle files without extensions', () => {
    const target = '/fake/dir/file';

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === target);

    const result = getNonConflictingPath(target);

    expect(result).toBe(path.join('/fake/dir', 'file (1)'));
  });
});

describe('SyncEngine Mobile Session Lifecycle', () => {
  it('should not include virtual mobile device when no mobile session is active', async () => {
    const { SyncEngine } = await import('../engine');
    const mockConfig: any = {
      deviceId: 'TEST-DEV',
      deviceName: 'Test Machine',
      targetFolder: '/test/folder',
      pairedDevices: []
    };

    const engine = new SyncEngine(mockConfig);
    const status = engine.getStatus();

    expect(status.isConnected).toBe(false);
    expect(status.pairedDevices.some((d: any) => d.id === 'mobile-web')).toBe(false);
  });

  it('should include virtual mobile device after mobile activity is marked and exclude after token reset', async () => {
    const { SyncEngine } = await import('../engine');
    const mockConfig: any = {
      deviceId: 'TEST-DEV',
      deviceName: 'Test Machine',
      targetFolder: '/test/folder',
      pairedDevices: []
    };

    const engine = new SyncEngine(mockConfig);
    engine.markMobileActivity();

    let status = engine.getStatus();
    expect(status.isConnected).toBe(true);
    expect(status.pairedDevices.some((d: any) => d.id === 'mobile-web')).toBe(true);

    engine.regenerateMobileSessionToken();
    status = engine.getStatus();
    expect(status.isConnected).toBe(false);
    expect(status.pairedDevices.some((d: any) => d.id === 'mobile-web')).toBe(false);
  });
});