import assert from 'node:assert';
import test from 'node:test';
import { isArchiveFile } from './archiver';

test('isArchiveFile correctly identifies archive extensions', () => {
    assert.strictEqual(isArchiveFile('file.zip'), true);
    assert.strictEqual(isArchiveFile('archive.rar'), true);
    assert.strictEqual(isArchiveFile('backup.7z'), true);
    assert.strictEqual(isArchiveFile('package.tar.gz'), true);
});

test('isArchiveFile correctly rejects non-archive extensions', () => {
    assert.strictEqual(isArchiveFile('image.png'), false);
    assert.strictEqual(isArchiveFile('document.txt'), false);
    assert.strictEqual(isArchiveFile('script.js'), false);
    assert.strictEqual(isArchiveFile('folder/file.pdf'), false);
});

test('isArchiveFile is case insensitive', () => {
    assert.strictEqual(isArchiveFile('FILE.ZIP'), true);
    assert.strictEqual(isArchiveFile('archive.RAR'), true);
    assert.strictEqual(isArchiveFile('BACKUP.7Z'), true);
});

test('isArchiveFile handles files without extensions', () => {
    assert.strictEqual(isArchiveFile('file'), false);
    assert.strictEqual(isArchiveFile('archive_name'), false);
    assert.strictEqual(isArchiveFile('.hiddenfile'), false);
});
