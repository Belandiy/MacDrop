import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import archiver from 'archiver';
import { app } from 'electron';

/**
 * List of known archive file extensions.
 */
const ARCHIVE_EXTENSIONS = new Set([
  '.zip',
  '.rar',
  '.7z',
  '.tar',
  '.gz',
  '.tgz',
  '.bz2',
  '.tbz2',
  '.xz',
  '.txz',
  '.iso',
  '.dmg',
  '.pkg',
  '.zst',
  '.cab',
  '.7za'
]);

/**
 * Checks whether a given path is an archive file by extension.
 */
export function isArchiveFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ARCHIVE_EXTENSIONS.has(ext);
}

export interface FolderZipProgress {
  processedBytes: number;
}

export interface FolderZipResult {
  zipPath: string;
  zipFilename: string;
  size: number;
  cleanup: () => Promise<void>;
}

export interface CreateZipOptions {
  onProgress?: (progress: FolderZipProgress) => void;
  signal?: AbortSignal;
}

/**
 * Creates a zip archive from a directory in the app's temporary folder.
 * Preserves directory structure inside the archive under the folder's name.
 */
export async function createZipFromFolder(
  folderPath: string,
  options?: CreateZipOptions
): Promise<FolderZipResult> {
  if (!fs.existsSync(folderPath)) {
    throw new Error(`Папка не найдена: ${folderPath}`);
  }

  const stat = fs.statSync(folderPath);
  if (!stat.isDirectory()) {
    throw new Error(`Указанный путь не является папкой: ${folderPath}`);
  }

  const tempBaseDir = path.join(app.getPath('temp'), 'macdrop_archives');
  if (!fs.existsSync(tempBaseDir)) {
    fs.mkdirSync(tempBaseDir, { recursive: true });
  }

  const rawName = path.basename(folderPath).trim() || 'archive';
  const sanitizedName = rawName.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'archive';
  const zipFilename = `${sanitizedName}.zip`;
  const tempFileId = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const tempZipPath = path.join(tempBaseDir, `${sanitizedName}_${tempFileId}.zip`);

  const outputStream = fs.createWriteStream(tempZipPath);
  const archive = archiver('zip', {
    zlib: { level: 6 } // standard Deflate compression level
  });

  let isCleanedUp = false;
  const cleanup = async () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    try {
      if (fs.existsSync(tempZipPath)) {
        await fs.promises.unlink(tempZipPath);
      }
    } catch (err) {
      console.warn(`Failed to cleanup temp archive ${tempZipPath}:`, err);
    }
  };

  return new Promise<FolderZipResult>((resolve, reject) => {
    let hasFailed = false;

    const handleError = async (err: Error) => {
      if (hasFailed) return;
      hasFailed = true;
      try {
        archive.abort();
      } catch {}
      try {
        outputStream.destroy();
      } catch {}
      await cleanup();
      reject(err);
    };

    if (options?.signal) {
      if (options.signal.aborted) {
        handleError(new Error('Архивация отменена'));
        return;
      }
      options.signal.addEventListener('abort', () => {
        handleError(new Error('Архивация отменена пользователем'));
      });
    }

    outputStream.on('close', () => {
      if (hasFailed) return;
      try {
        const fileStat = fs.statSync(tempZipPath);
        resolve({
          zipPath: tempZipPath,
          zipFilename,
          size: fileStat.size,
          cleanup
        });
      } catch (err: any) {
        handleError(err);
      }
    });

    archive.on('error', (err: any) => {
      handleError(err);
    });

    archive.on('warning', (err: any) => {
      if (err.code === 'ENOENT') {
        console.warn('Archiver warning:', err);
      } else {
        handleError(err);
      }
    });

    archive.on('progress', (data: archiver.ProgressData) => {
      if (options?.onProgress) {
        options.onProgress({ processedBytes: data.fs.processedBytes });
      }
    });

    archive.pipe(outputStream);
    archive.directory(folderPath, sanitizedName);
    archive.finalize().catch((err: any) => handleError(err));
  });
}
