import { describe, it, expect } from 'vitest';
import { isArchiveFile } from './archiver';

describe('isArchiveFile', () => {
  it('correctly identifies archive extensions', () => {
    expect(isArchiveFile('file.zip')).toBe(true);
    expect(isArchiveFile('archive.rar')).toBe(true);
    expect(isArchiveFile('backup.7z')).toBe(true);
    expect(isArchiveFile('package.tar.gz')).toBe(true);
  });

  it('correctly rejects non-archive extensions', () => {
    expect(isArchiveFile('image.png')).toBe(false);
    expect(isArchiveFile('document.txt')).toBe(false);
    expect(isArchiveFile('script.js')).toBe(false);
    expect(isArchiveFile('folder/file.pdf')).toBe(false);
  });

  it('is case insensitive', () => {
    expect(isArchiveFile('FILE.ZIP')).toBe(true);
    expect(isArchiveFile('archive.RAR')).toBe(true);
    expect(isArchiveFile('BACKUP.7Z')).toBe(true);
  });

  it('handles files without extensions', () => {
    expect(isArchiveFile('file')).toBe(false);
    expect(isArchiveFile('archive_name')).toBe(false);
    expect(isArchiveFile('.hiddenfile')).toBe(false);
  });
});
