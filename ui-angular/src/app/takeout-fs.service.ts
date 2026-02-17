import { Injectable } from '@angular/core';
import * as zip from '@zip.js/zip.js';

export interface ZipStatus {
  total: number;
  unpacked: number;
  pending: number;
}

@Injectable({ providedIn: 'root' })
export class TakeoutFsService {
  private readonly imageExts = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.heic', '.heif', '.webp', '.tiff', '.tif', '.bmp', '.dng', '.cr2', '.cr3', '.nef', '.arw', '.raf', '.rw2', '.jfif'
  ]);

  private readonly videoExts = new Set([
    '.mp4', '.mov', '.m4v', '.avi', '.mkv', '.mts', '.m2ts', '.3gp', '.3gpp', '.3g2', '.webm', '.mpg', '.mpeg', '.mpe', '.wmv', '.flv', '.dv'
  ]);

  async pickDirectory(): Promise<FileSystemDirectoryHandle> {
    return window.showDirectoryPicker({ mode: 'readwrite' });
  }

  async scanStatus(zipDir: FileSystemDirectoryHandle, outDir: FileSystemDirectoryHandle): Promise<ZipStatus> {
    const zips = await this.listZipFiles(zipDir);
    const unpackRoot = await this.ensureDir(outDir, ['unpacked']);

    let unpacked = 0;
    for (const item of zips) {
      const base = item.name.replace(/\.zip$/i, '');
      const maybe = await this.getDirIfExists(unpackRoot, [base]);
      if (maybe) {
        unpacked += 1;
      }
    }

    return { total: zips.length, unpacked, pending: zips.length - unpacked };
  }

  async unpackMissing(zipDir: FileSystemDirectoryHandle, outDir: FileSystemDirectoryHandle): Promise<number> {
    const zips = await this.listZipFiles(zipDir);
    const unpackRoot = await this.ensureDir(outDir, ['unpacked']);

    let unpackedNow = 0;
    for (const item of zips) {
      const base = item.name.replace(/\.zip$/i, '');
      const maybe = await this.getDirIfExists(unpackRoot, [base]);
      if (maybe) {
        continue;
      }

      const target = await this.ensureDir(unpackRoot, [base]);
      await this.unpackOneZip(item.handle, target);
      unpackedNow += 1;
    }

    return unpackedNow;
  }

  async movePhotos(outDir: FileSystemDirectoryHandle): Promise<number> {
    return this.moveByType(outDir, this.imageExts, 'photos');
  }

  async moveVideos(outDir: FileSystemDirectoryHandle): Promise<number> {
    return this.moveByType(outDir, this.videoExts, 'videos');
  }

  async removeByExtension(outDir: FileSystemDirectoryHandle, extension: string): Promise<number> {
    const normalized = extension.toLowerCase();
    if (!normalized.startsWith('.')) {
      throw new Error('Extension must start with dot, for example .json');
    }

    const unpackRoot = await this.ensureDir(outDir, ['unpacked']);
    let removed = 0;

    for await (const item of this.walkFiles(unpackRoot)) {
      if (this.ext(item.name) !== normalized) {
        continue;
      }
      await item.parent.removeEntry(item.name);
      removed += 1;
    }

    return removed;
  }

  async removeEmptyFolders(outDir: FileSystemDirectoryHandle): Promise<number> {
    const unpackRoot = await this.ensureDir(outDir, ['unpacked']);
    return this.sweepEmpty(unpackRoot);
  }

  async buildFixtureZip(zipDir: FileSystemDirectoryHandle): Promise<void> {
    const sourceRoot = await this.getDirIfExists(zipDir, ['source', 'takeout-sample']);
    if (!sourceRoot) {
      throw new Error('Expected fixture source at <zip source>/source/takeout-sample');
    }

    const writer = new zip.ZipWriter(new zip.BlobWriter('application/zip'));

    for await (const item of this.walkFiles(sourceRoot)) {
      const file = await item.handle.getFile();
      const fullPath = [...item.pathParts, item.name].join('/');
      await writer.add(fullPath, new zip.BlobReader(file));
    }

    const blob = await writer.close();
    await this.writeFile(zipDir, 'takeout-sample.zip', blob);
  }

  private async sweepEmpty(dir: FileSystemDirectoryHandle): Promise<number> {
    let removed = 0;
    for await (const [name, handle] of (dir as any).entries()) {
      if (handle.kind !== 'directory') {
        continue;
      }

      removed += await this.sweepEmpty(handle);

      let empty = true;
      for await (const _ of (handle as any).entries()) {
        empty = false;
        break;
      }

      if (empty) {
        await dir.removeEntry(name, { recursive: false });
        removed += 1;
      }
    }

    return removed;
  }

  private async moveByType(outDir: FileSystemDirectoryHandle, exts: Set<string>, label: 'photos' | 'videos'): Promise<number> {
    const unpackRoot = await this.ensureDir(outDir, ['unpacked']);
    const targetDir = await this.ensureDir(outDir, [label]);
    let moved = 0;

    for await (const item of this.walkFiles(unpackRoot)) {
      if (!exts.has(this.ext(item.name))) {
        continue;
      }

      const src = await item.handle.getFile();
      const name = await this.findUniqueName(targetDir, item.name);
      await this.writeFile(targetDir, name, await src.arrayBuffer());
      await item.parent.removeEntry(item.name);
      moved += 1;
    }

    return moved;
  }

  private async unpackOneZip(fileHandle: FileSystemFileHandle, targetDir: FileSystemDirectoryHandle): Promise<void> {
    const zipFile = await fileHandle.getFile();
    const reader = new zip.ZipReader(new zip.BlobReader(zipFile));
    const entries = await reader.getEntries();

    for (const entry of entries) {
      const parts = entry.filename.split('/').filter(Boolean);
      if (parts.length === 0) {
        continue;
      }

      if (entry.directory) {
        await this.ensureDir(targetDir, parts);
        continue;
      }

      const parent = await this.ensureDir(targetDir, parts.slice(0, -1));
      const data = await entry.getData(new zip.Uint8ArrayWriter());
      await this.writeFile(parent, parts[parts.length - 1], data);
    }

    await reader.close();
  }

  private async writeFile(dirHandle: FileSystemDirectoryHandle, fileName: string, data: Blob | BufferSource): Promise<void> {
    const fh = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fh.createWritable();
    await writable.write(data);
    await writable.close();
  }

  private async listZipFiles(zipDir: FileSystemDirectoryHandle): Promise<Array<{ name: string; handle: FileSystemFileHandle }>> {
    const out: Array<{ name: string; handle: FileSystemFileHandle }> = [];
    for await (const [name, handle] of (zipDir as any).entries()) {
      if (handle.kind === 'file' && name.toLowerCase().endsWith('.zip')) {
        out.push({ name, handle });
      }
    }

    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }

  private async ensureDir(base: FileSystemDirectoryHandle, parts: string[]): Promise<FileSystemDirectoryHandle> {
    let current = base;
    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: true });
    }
    return current;
  }

  private async getDirIfExists(base: FileSystemDirectoryHandle, parts: string[]): Promise<FileSystemDirectoryHandle | null> {
    let current = base;
    for (const part of parts) {
      try {
        current = await current.getDirectoryHandle(part);
      } catch {
        return null;
      }
    }
    return current;
  }

  private ext(name: string): string {
    const i = name.lastIndexOf('.');
    return i >= 0 ? name.slice(i).toLowerCase() : '';
  }

  private async findUniqueName(dir: FileSystemDirectoryHandle, fileName: string): Promise<string> {
    const dot = fileName.lastIndexOf('.');
    const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
    const suffix = dot > 0 ? fileName.slice(dot) : '';

    let candidate = fileName;
    let idx = 1;
    while (true) {
      try {
        await dir.getFileHandle(candidate);
        candidate = `${stem}-${idx}${suffix}`;
        idx += 1;
      } catch {
        return candidate;
      }
    }
  }

  private async *walkFiles(
    dir: FileSystemDirectoryHandle,
    pathParts: string[] = []
  ): AsyncGenerator<{ name: string; handle: FileSystemFileHandle; parent: FileSystemDirectoryHandle; pathParts: string[] }> {
    for await (const [name, handle] of (dir as any).entries()) {
      if (handle.kind === 'directory') {
        yield* this.walkFiles(handle, [...pathParts, name]);
      } else {
        yield { name, handle, parent: dir, pathParts };
      }
    }
  }
}
