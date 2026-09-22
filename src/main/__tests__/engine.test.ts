import { describe, it, expect, vi } from 'vitest';
import { getSafeResolvedPath } from '../engine';
import path from 'path';

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