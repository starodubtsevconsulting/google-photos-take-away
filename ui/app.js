import * as zip from 'https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.7.57/+esm';

const imageExts = new Set(['.jpg', '.jpeg', '.png', '.gif', '.heic', '.heif', '.webp', '.tiff', '.tif', '.bmp', '.dng', '.cr2', '.cr3', '.nef', '.arw', '.raf', '.rw2', '.jfif']);
const videoExts = new Set(['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.mts', '.m2ts', '.3gp', '.3gpp', '.3g2', '.webm', '.mpg', '.mpeg', '.mpe', '.wmv', '.flv', '.dv']);

const els = {
  pickZipDir: document.getElementById('pickZipDir'),
  pickOutDir: document.getElementById('pickOutDir'),
  scan: document.getElementById('scan'),
  buildFixture: document.getElementById('buildFixture'),
  unpackMissing: document.getElementById('unpackMissing'),
  movePhotos: document.getElementById('movePhotos'),
  moveVideos: document.getElementById('moveVideos'),
  removeByExt: document.getElementById('removeByExt'),
  removeEmpty: document.getElementById('removeEmpty'),
  zipDirLabel: document.getElementById('zipDirLabel'),
  outDirLabel: document.getElementById('outDirLabel'),
  zipTotal: document.getElementById('zipTotal'),
  zipUnpacked: document.getElementById('zipUnpacked'),
  zipPending: document.getElementById('zipPending'),
  log: document.getElementById('log'),
};

const state = {
  zipDir: null,
  outDir: null,
};

function log(msg) {
  const now = new Date().toLocaleTimeString();
  els.log.textContent += `[${now}] ${msg}\n`;
  els.log.scrollTop = els.log.scrollHeight;
}

function ext(name) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

async function ensureDir(base, parts) {
  let current = base;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create: true });
  }
  return current;
}

async function getDirIfExists(base, parts) {
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

async function listZipFiles(zipDir) {
  const out = [];
  for await (const [name, handle] of zipDir.entries()) {
    if (handle.kind === 'file' && name.toLowerCase().endsWith('.zip')) {
      out.push({ name, handle });
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

async function analyzeStatus() {
  if (!state.zipDir || !state.outDir) {
    throw new Error('Pick ZIP source and output folders first.');
  }

  const zips = await listZipFiles(state.zipDir);
  const unpackRoot = await ensureDir(state.outDir, ['unpacked']);

  let unpacked = 0;
  for (const item of zips) {
    const base = item.name.replace(/\.zip$/i, '');
    const dir = await getDirIfExists(unpackRoot, [base]);
    if (dir) unpacked += 1;
  }

  const pending = zips.length - unpacked;
  els.zipTotal.textContent = String(zips.length);
  els.zipUnpacked.textContent = String(unpacked);
  els.zipPending.textContent = String(pending);

  return { zips, unpacked, pending, unpackRoot };
}

async function writeFile(dirHandle, fileName, data) {
  const fh = await dirHandle.getFileHandle(fileName, { create: true });
  const w = await fh.createWritable();
  await w.write(data);
  await w.close();
}

async function unpackOneZip(fileHandle, targetDir) {
  const zipFile = await fileHandle.getFile();
  const reader = new zip.ZipReader(new zip.BlobReader(zipFile));
  const entries = await reader.getEntries();

  for (const entry of entries) {
    const parts = entry.filename.split('/').filter(Boolean);
    if (parts.length === 0) continue;

    if (entry.directory) {
      await ensureDir(targetDir, parts);
      continue;
    }

    const parent = await ensureDir(targetDir, parts.slice(0, -1));
    const data = await entry.getData(new zip.Uint8ArrayWriter());
    await writeFile(parent, parts[parts.length - 1], data);
  }

  await reader.close();
}

async function* walkFiles(dirHandle, pathParts = []) {
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === 'directory') {
      yield* walkFiles(handle, [...pathParts, name]);
      continue;
    }
    yield { name, handle, parent: dirHandle, pathParts };
  }
}

async function findUniqueName(dirHandle, name) {
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const suffix = dot > 0 ? name.slice(dot) : '';

  let candidate = name;
  let idx = 1;
  while (true) {
    try {
      await dirHandle.getFileHandle(candidate);
      candidate = `${stem}-${idx}${suffix}`;
      idx += 1;
    } catch {
      return candidate;
    }
  }
}

async function moveByType(set, label) {
  if (!state.outDir) throw new Error('Pick output folder first.');
  const unpackRoot = await ensureDir(state.outDir, ['unpacked']);
  const targetDir = await ensureDir(state.outDir, [label]);

  let moved = 0;
  for await (const item of walkFiles(unpackRoot)) {
    if (!set.has(ext(item.name))) continue;

    const srcFile = await item.handle.getFile();
    const name = await findUniqueName(targetDir, item.name);
    await writeFile(targetDir, name, await srcFile.arrayBuffer());
    await item.parent.removeEntry(item.name);
    moved += 1;
  }

  log(`Moved ${moved} ${label} file(s).`);
}

async function removeByExtension() {
  if (!state.outDir) throw new Error('Pick output folder first.');
  const extension = window.prompt('Extension to remove (example: .json):', '.json');
  if (!extension) return;
  if (!extension.startsWith('.')) throw new Error('Extension must start with dot.');

  const unpackRoot = await ensureDir(state.outDir, ['unpacked']);
  let removed = 0;
  for await (const item of walkFiles(unpackRoot)) {
    if (ext(item.name) !== extension.toLowerCase()) continue;
    await item.parent.removeEntry(item.name);
    removed += 1;
  }
  log(`Removed ${removed} file(s) by extension ${extension}.`);
}

async function removeEmptyDirs() {
  if (!state.outDir) throw new Error('Pick output folder first.');
  const unpackRoot = await ensureDir(state.outDir, ['unpacked']);

  async function sweep(dir) {
    let removed = 0;
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind !== 'directory') continue;
      removed += await sweep(handle);

      let empty = true;
      for await (const _ of handle.entries()) {
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

  const removed = await sweep(unpackRoot);
  log(`Removed ${removed} empty folder(s).`);
}

async function buildFixtureZip() {
  if (!state.zipDir) throw new Error('Pick ZIP source folder first.');
  const sourceRoot = await getDirIfExists(state.zipDir, ['source', 'takeout-sample']);
  if (!sourceRoot) throw new Error('Expected fixture source at <zip source>/source/takeout-sample');

  const writer = new zip.ZipWriter(new zip.BlobWriter('application/zip'));
  for await (const item of walkFiles(sourceRoot)) {
    const file = await item.handle.getFile();
    const fullPath = [...item.pathParts, item.name].join('/');
    await writer.add(fullPath, new zip.BlobReader(file));
  }

  const blob = await writer.close();
  await writeFile(state.zipDir, 'takeout-sample.zip', blob);
  log('Created test/src/takeout-sample.zip from source fixture.');
}

async function unpackMissing() {
  const { zips, unpackRoot } = await analyzeStatus();
  let unpackedNow = 0;

  for (const item of zips) {
    const base = item.name.replace(/\.zip$/i, '');
    const maybe = await getDirIfExists(unpackRoot, [base]);
    if (maybe) continue;

    const target = await ensureDir(unpackRoot, [base]);
    log(`Unpacking ${item.name}...`);
    await unpackOneZip(item.handle, target);
    unpackedNow += 1;
  }

  log(`Unpacked ${unpackedNow} zip(s).`);
  await analyzeStatus();
}

async function run(action) {
  try {
    els.log.textContent ||= '';
    await action();
  } catch (e) {
    log(`ERROR: ${e.message || e}`);
  }
}

els.pickZipDir.addEventListener('click', () => run(async () => {
  state.zipDir = await window.showDirectoryPicker({ mode: 'readwrite' });
  els.zipDirLabel.textContent = `ZIP source: ${state.zipDir.name}`;
  log(`Selected ZIP source: ${state.zipDir.name}`);
}));

els.pickOutDir.addEventListener('click', () => run(async () => {
  state.outDir = await window.showDirectoryPicker({ mode: 'readwrite' });
  els.outDirLabel.textContent = `Output root: ${state.outDir.name}`;
  log(`Selected output root: ${state.outDir.name}`);
}));

els.scan.addEventListener('click', () => run(async () => {
  const status = await analyzeStatus();
  log(`Status: ${status.unpacked}/${status.zips.length} unpacked, ${status.pending} pending.`);
}));

els.buildFixture.addEventListener('click', () => run(buildFixtureZip));
els.unpackMissing.addEventListener('click', () => run(unpackMissing));
els.movePhotos.addEventListener('click', () => run(() => moveByType(imageExts, 'photos')));
els.moveVideos.addEventListener('click', () => run(() => moveByType(videoExts, 'videos')));
els.removeByExt.addEventListener('click', () => run(removeByExtension));
els.removeEmpty.addEventListener('click', () => run(removeEmptyDirs));

log('Ready. Pick ZIP source + output folders to begin.');
