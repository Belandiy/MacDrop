import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

import { getNonConflictingPath } from '../engine';

describe('getNonConflictingPath', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('should return targetPath if it does not exist', () => {
    mock.method(fs, 'existsSync', () => false);

    const target = '/fake/dir/file.txt';
    const result = getNonConflictingPath(target);

    assert.strictEqual(result, target);
  });

  it('should append (1) if the targetPath already exists', () => {
    const target = '/fake/dir/file.txt';

    mock.method(fs, 'existsSync', (p: fs.PathLike) => {
      if (p === target) return true;
      return false;
    });

    const result = getNonConflictingPath(target);

    assert.strictEqual(result, path.join('/fake/dir', 'file (1).txt'));
  });

  it('should append next available number if multiple suffixes exist', () => {
    const target = '/fake/dir/file.txt';
    const firstSuffix = path.join('/fake/dir', 'file (1).txt');
    const secondSuffix = path.join('/fake/dir', 'file (2).txt');

    mock.method(fs, 'existsSync', (p: fs.PathLike) => {
      if (p === target) return true;
      if (p === firstSuffix) return true;
      if (p === secondSuffix) return true;
      return false;
    });

    const result = getNonConflictingPath(target);

    assert.strictEqual(result, path.join('/fake/dir', 'file (3).txt'));
  });

  it('should handle files without extensions', () => {
    const target = '/fake/dir/file';

    mock.method(fs, 'existsSync', (p: fs.PathLike) => {
      if (p === target) return true;
      return false;
    });

    const result = getNonConflictingPath(target);

    assert.strictEqual(result, path.join('/fake/dir', 'file (1)'));
  });
});
