import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TakeoutFsService, ZipStatus } from './takeout-fs.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  zipDir: FileSystemDirectoryHandle | null = null;
  outDir: FileSystemDirectoryHandle | null = null;
  status: ZipStatus = { total: 0, unpacked: 0, pending: 0 };
  logs: string[] = ['Ready. Pick ZIP source and output folders.'];
  busy = false;

  constructor(private readonly fsService: TakeoutFsService) {}

  async pickZipDir(): Promise<void> {
    await this.run(async () => {
      this.zipDir = await this.fsService.pickDirectory();
      this.log(`ZIP source selected: ${this.zipDir.name}`);
    });
  }

  async pickOutDir(): Promise<void> {
    await this.run(async () => {
      this.outDir = await this.fsService.pickDirectory();
      this.log(`Output root selected: ${this.outDir.name}`);
    });
  }

  async scanStatus(): Promise<void> {
    await this.run(async () => {
      this.assertDirs();
      this.status = await this.fsService.scanStatus(this.zipDir!, this.outDir!);
      this.log(`Status: ${this.status.unpacked}/${this.status.total} unpacked, ${this.status.pending} pending.`);
    });
  }

  async buildFixtureZip(): Promise<void> {
    await this.run(async () => {
      if (!this.zipDir) throw new Error('Pick ZIP source first.');
      await this.fsService.buildFixtureZip(this.zipDir);
      this.log('Fixture zip rebuilt: takeout-sample.zip');
      await this.scanStatus();
    });
  }

  async unpackMissing(): Promise<void> {
    await this.run(async () => {
      this.assertDirs();
      const count = await this.fsService.unpackMissing(this.zipDir!, this.outDir!);
      this.log(`Unpacked ${count} zip(s).`);
      await this.scanStatus();
    });
  }

  async movePhotos(): Promise<void> {
    await this.run(async () => {
      if (!this.outDir) throw new Error('Pick output root first.');
      const moved = await this.fsService.movePhotos(this.outDir);
      this.log(`Moved ${moved} photo file(s).`);
    });
  }

  async moveVideos(): Promise<void> {
    await this.run(async () => {
      if (!this.outDir) throw new Error('Pick output root first.');
      const moved = await this.fsService.moveVideos(this.outDir);
      this.log(`Moved ${moved} video file(s).`);
    });
  }

  async removeByExtension(): Promise<void> {
    await this.run(async () => {
      if (!this.outDir) throw new Error('Pick output root first.');
      const ext = window.prompt('Extension to remove (example: .json)', '.json');
      if (!ext) return;
      const removed = await this.fsService.removeByExtension(this.outDir, ext);
      this.log(`Removed ${removed} file(s) with extension ${ext}.`);
    });
  }

  async removeEmptyFolders(): Promise<void> {
    await this.run(async () => {
      if (!this.outDir) throw new Error('Pick output root first.');
      const removed = await this.fsService.removeEmptyFolders(this.outDir);
      this.log(`Removed ${removed} empty folder(s).`);
    });
  }

  private assertDirs(): void {
    if (!this.zipDir || !this.outDir) {
      throw new Error('Pick ZIP source and output folders first.');
    }
  }

  private log(message: string): void {
    const now = new Date().toLocaleTimeString();
    this.logs = [...this.logs, `[${now}] ${message}`];
  }

  private async run(task: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await task();
    } catch (err) {
      this.log(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.busy = false;
    }
  }
}
