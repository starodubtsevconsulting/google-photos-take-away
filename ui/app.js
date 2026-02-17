import * as zip from 'https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.7.57/+esm';

const imageExts = new Set(['.jpg', '.jpeg', '.png', '.gif', '.heic', '.heif', '.webp', '.tiff', '.tif', '.bmp', '.dng', '.cr2', '.cr3', '.nef', '.arw', '.raf', '.rw2', '.jfif']);
const videoExts = new Set(['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.mts', '.m2ts', '.3gp', '.3gpp', '.3g2', '.webm', '.mpg', '.mpeg', '.mpe', '.wmv', '.flv', '.dv']);

const els = {
  pickZipDir: document.getElementById('pickZipDir'),
  pickOutDir: document.getElementById('pickOutDir'),
  stepPickZipDir: document.getElementById('stepPickZipDir'),
  stepPickOutDir: document.getElementById('stepPickOutDir'),
  clearStep1: document.getElementById('clearStep1'),
  clearStep2: document.getElementById('clearStep2'),
  clearStep3: document.getElementById('clearStep3'),
  clearStep4: document.getElementById('clearStep4'),
  clearStep5: document.getElementById('clearStep5'),
  stepUnpackBtn: document.getElementById('stepUnpackBtn'),
  step2Progress: document.getElementById('step2Progress'),
  resetState: document.getElementById('resetState'),
  scan: document.getElementById('scan'),
  buildFixture: document.getElementById('buildFixture'),
  unpackMissing: document.getElementById('unpackMissing'),
  stepFlattenBtnMirror: document.getElementById('stepFlattenBtnMirror'),
  analyzeLeftovers: document.getElementById('analyzeLeftovers'),
  removeByExt: document.getElementById('removeByExt'),
  removeSelectedExt: document.getElementById('removeSelectedExt'),
  removeEmpty: document.getElementById('removeEmpty'),
  zipDirLabel: document.getElementById('zipDirLabel'),
  outDirLabel: document.getElementById('outDirLabel'),
  zipTotal: document.getElementById('zipTotal'),
  zipUnpacked: document.getElementById('zipUnpacked'),
  zipPending: document.getElementById('zipPending'),
  pipelineGoal: document.getElementById('pipelineGoal'),
  step1: document.getElementById('step1'),
  step2: document.getElementById('step2'),
  step3: document.getElementById('step3'),
  step4: document.getElementById('step4'),
  step5: document.getElementById('step5'),
  step1Text: document.getElementById('step1Text'),
  step1Details: document.getElementById('step1Details'),
  step1ZipName: document.getElementById('step1ZipName'),
  step1OutName: document.getElementById('step1OutName'),
  step1SaveState: document.getElementById('step1SaveState'),
  step2Text: document.getElementById('step2Text'),
  step3Text: document.getElementById('step3Text'),
  step4Text: document.getElementById('step4Text'),
  step5Text: document.getElementById('step5Text'),
  step3TypeImages: document.getElementById('step3TypeImages'),
  step3TypeVideos: document.getElementById('step3TypeVideos'),
  stepFlattenBtn: document.getElementById('stepFlattenBtn'),
  leftovers: document.getElementById('leftovers'),
  log: document.getElementById('log'),
};

const state = {
  zipDir: null,
  outDir: null,
  lastExtCounts: new Map(),
  lastTotalLeft: 0,
  pipelinePosition: 1,
  pipelineLabel: 'Pick Source + Destination',
};

const DB_NAME = 'takeout-ui-state';
const DB_STORE = 'kv';
const HANDLE_ZIP_KEY = 'zipDirHandle';
const HANDLE_OUT_KEY = 'outDirHandle';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function setPersistedValue(key, value) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function clearPersistedValue(key) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function getPersistedValue(key) {
  const db = await openDb();
  const value = await new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return value;
}

async function persistStateFile() {
  const payload = {
    zipDirName: state.zipDir?.name || null,
    outDirName: state.outDir?.name || null,
    pipelinePosition: state.pipelinePosition,
    pipelineLabel: state.pipelineLabel,
    savedAt: new Date().toISOString(),
  };

  try {
    await fetch('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Local API may be temporarily unavailable; UI still works from handles.
  }
}

async function loadServerState() {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

function setPipelinePosition(step, label) {
  state.pipelinePosition = step;
  state.pipelineLabel = label;
}

function applyPipelineCursor() {
  const steps = [els.step1, els.step2, els.step3, els.step4, els.step5];
  steps.forEach((el, idx) => {
    el.dataset.cursor = (idx + 1) === state.pipelinePosition ? 'yes' : 'no';
  });
}

function syncStep1Lock() {
  const locked = state.pipelinePosition >= 2;
  els.pickZipDir.disabled = locked;
  els.pickOutDir.disabled = locked;
  els.stepPickZipDir.disabled = locked;
  els.stepPickOutDir.disabled = locked;
}

function syncStepClearLocks() {
  const pairs = [
    [els.step1, els.clearStep1],
    [els.step2, els.clearStep2],
    [els.step3, els.clearStep3],
    [els.step4, els.clearStep4],
    [els.step5, els.clearStep5],
  ];
  for (const [stepEl, btn] of pairs) {
    btn.disabled = stepEl.dataset.cursor !== 'yes';
  }
}

function log(msg) {
  const now = new Date().toLocaleTimeString();
  els.log.textContent += `[${now}] ${msg}\n`;
  els.log.scrollTop = els.log.scrollHeight;
}

function ext(name) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '<no-ext>';
}

function setStep(stepEl, textEl, status, text) {
  stepEl.dataset.status = status;
  textEl.textContent = text;
}

function displayPathFromHandle(handle) {
  if (!handle) return 'not selected';
  return `.../${handle.name}`;
}

function refreshStep1Details(saveStatusText = null) {
  const zipText = `ZIPs: ${displayPathFromHandle(state.zipDir)}`;
  const outText = `Output: ${displayPathFromHandle(state.outDir)}`;
  els.step1ZipName.textContent = zipText;
  els.step1OutName.textContent = outText;
  if (saveStatusText) {
    els.step1SaveState.textContent = saveStatusText;
  }

  const expanded = Boolean(state.zipDir || state.outDir);
  els.step1Details.dataset.expanded = expanded ? 'yes' : 'no';
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
  const unpackRoot = await getDirIfExists(state.outDir, ['unpacked']);

  let unpacked = 0;
  if (unpackRoot) {
    for (const item of zips) {
      const base = item.name.replace(/\.zip$/i, '');
      const dir = await getDirIfExists(unpackRoot, [base]);
      if (dir) unpacked += 1;
    }
  }

  const total = zips.length;
  const pending = total - unpacked;
  els.zipTotal.textContent = String(total);
  els.zipUnpacked.textContent = String(unpacked);
  els.zipPending.textContent = String(pending);

  return { zips, total, unpacked, pending, unpackRoot };
}

async function removeSubdir(outDir, subdirName) {
  try {
    await outDir.removeEntry(subdirName, { recursive: true });
  } catch {
    // Ignore when folder does not exist.
  }
}

async function writeFile(dirHandle, fileName, data) {
  const fh = await dirHandle.getFileHandle(fileName, { create: true });
  const w = await fh.createWritable();
  await w.write(data);
  await w.close();
}

async function unpackOneZip(fileHandle, targetDir, onProgress = null, zipLabel = 'zip') {
  const zipFile = await fileHandle.getFile();
  const reader = new zip.ZipReader(new zip.BlobReader(zipFile));
  const entries = await reader.getEntries();
  const total = Math.max(entries.length, 1);
  let processed = 0;

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
    processed += 1;
    if (onProgress) {
      const pct = Math.floor((processed * 100) / total);
      onProgress({ zipLabel, processed, total, pct });
    }
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

function countForExtensionSet(extCounts, set) {
  let count = 0;
  for (const [extension, n] of extCounts.entries()) {
    if (set.has(extension)) {
      count += n;
    }
  }
  return count;
}

function renderLeftovers(extCounts) {
  const entries = [...extCounts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  if (entries.length === 0) {
    els.leftovers.innerHTML = '<p class="leftovers-empty">Nothing left in source. Pipeline target achieved.</p>';
    return;
  }

  const rows = entries
    .map(([extension, count]) => {
      const safeExt = extension.replace(/"/g, '&quot;');
      return `<label class="left-row"><input type="checkbox" data-ext="${safeExt}"> <code>${extension}</code> <span>${count}</span></label>`;
    })
    .join('');

  els.leftovers.innerHTML = `<div class="left-grid">${rows}</div>`;
}

async function analyzeLeftoversOnly() {
  if (!state.outDir) throw new Error('Pick output folder first.');
  const unpackRoot = await getDirIfExists(state.outDir, ['unpacked']);
  const extCounts = new Map();

  if (unpackRoot) {
    for await (const item of walkFiles(unpackRoot)) {
      const extension = ext(item.name);
      extCounts.set(extension, (extCounts.get(extension) || 0) + 1);
    }
  }

  let total = 0;
  for (const n of extCounts.values()) total += n;

  state.lastExtCounts = extCounts;
  state.lastTotalLeft = total;
  renderLeftovers(extCounts);
  return { extCounts, total };
}

async function refreshPipelineView() {
  const hasDirs = Boolean(state.zipDir && state.outDir);

  if (!hasDirs && state.pipelinePosition !== 1) {
    setPipelinePosition(1, 'Pick Source + Destination');
  }

  if (hasDirs && state.pipelinePosition < 2) {
    setPipelinePosition(2, 'Unpack ZIPs');
  }

  syncStep1Lock();

  if (!hasDirs) {
    setStep(els.step1, els.step1Text, 'active', 'Pick ZIP source and output folders.');
    setStep(els.step2, els.step2Text, 'idle', 'Waiting for folders.');
    setStep(els.step3, els.step3Text, 'idle', 'Waiting for unpacked files.');
    setStep(els.step4, els.step4Text, 'idle', 'Waiting for unpacked files.');
    setStep(els.step5, els.step5Text, 'idle', 'Analyze leftovers when ready.');
    els.stepUnpackBtn.style.display = 'none';
    els.step2Progress.textContent = 'Progress: idle';
    els.pipelineGoal.textContent = `Source files left: - | Last position: ${state.pipelinePosition}. ${state.pipelineLabel}`;
    applyPipelineCursor();
    syncStepClearLocks();
    return;
  }

  const status = await analyzeStatus();
  const leftovers = await analyzeLeftoversOnly();
  const imageLeft = countForExtensionSet(leftovers.extCounts, imageExts);
  const videoLeft = countForExtensionSet(leftovers.extCounts, videoExts);
  const mediaLeft = imageLeft + videoLeft;

  if (status.total > 0 && status.pending > 0 && state.pipelinePosition > 2) {
    setPipelinePosition(2, 'Unpack ZIPs');
  }

  if (status.total > 0 && status.pending === 0 && state.pipelinePosition < 3) {
    setPipelinePosition(3, 'Flatten Files');
  }

  setStep(els.step1, els.step1Text, 'done', `ZIP source: ${state.zipDir.name} | Output: ${state.outDir.name}`);

  if (status.total === 0) {
    setStep(els.step2, els.step2Text, 'active', 'No ZIP files found in source folder yet.');
    els.stepUnpackBtn.style.display = 'none';
  } else if (status.pending > 0) {
    setStep(els.step2, els.step2Text, 'active', `${status.pending} of ${status.total} ZIP(s) still pending.`);
    els.stepUnpackBtn.style.display = 'inline-block';
  } else {
    setStep(els.step2, els.step2Text, 'done', `All ${status.total} ZIP(s) unpacked.`);
    els.stepUnpackBtn.style.display = 'none';
    els.step2Progress.textContent = 'Progress: complete';
  }

  if (status.unpacked === 0) {
    setStep(els.step3, els.step3Text, 'idle', 'No unpacked content yet.');
    setStep(els.step4, els.step4Text, 'idle', 'Waiting for flatten step.');
  } else {
    setStep(
      els.step3,
      els.step3Text,
      mediaLeft === 0 ? 'done' : 'active',
      mediaLeft === 0
        ? 'No selected media files left in source.'
        : `${mediaLeft} media file(s) still in source (images: ${imageLeft}, videos: ${videoLeft}).`
    );
    setStep(els.step4, els.step4Text, 'idle', 'Type selection is handled in Step 3.');
  }

  setStep(els.step5, els.step5Text, leftovers.total === 0 ? 'done' : 'active', leftovers.total === 0 ? 'Source is empty. Done.' : `${leftovers.total} file(s) remain. Choose extensions to keep/remove.`);
  els.pipelineGoal.textContent = `Source files left: ${leftovers.total} | Last position: ${state.pipelinePosition}. ${state.pipelineLabel}`;
  els.pipelineGoal.dataset.empty = leftovers.total === 0 ? 'yes' : 'no';
  applyPipelineCursor();
  syncStepClearLocks();
}

async function moveByType(set, label) {
  if (!state.outDir) throw new Error('Pick output folder first.');
  const unpackRoot = await getDirIfExists(state.outDir, ['unpacked']);
  if (!unpackRoot) {
    log('No unpacked folder yet. Click Unpack first.');
    return 0;
  }
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
  return moved;
}

async function flattenSelectedFiles() {
  const includeImages = Boolean(els.step3TypeImages.checked);
  const includeVideos = Boolean(els.step3TypeVideos.checked);
  if (!includeImages && !includeVideos) {
    throw new Error('Select at least one type in Step 3 (images/videos).');
  }

  let movedTotal = 0;
  if (includeImages) {
    movedTotal += await moveByType(imageExts, 'photos');
  }
  if (includeVideos) {
    movedTotal += await moveByType(videoExts, 'videos');
  }
  log(`Flatten selected files complete. Total moved: ${movedTotal}.`);
}

async function removeByExtensionPrompt() {
  if (!state.outDir) throw new Error('Pick output folder first.');
  const extension = window.prompt('Extension to remove (example: .json):', '.json');
  if (!extension) return;
  if (!extension.startsWith('.')) throw new Error('Extension must start with dot.');

  const unpackRoot = await getDirIfExists(state.outDir, ['unpacked']);
  if (!unpackRoot) {
    log('No unpacked folder yet. Nothing to remove.');
    return;
  }
  let removed = 0;
  const normalized = extension.toLowerCase();
  for await (const item of walkFiles(unpackRoot)) {
    if (ext(item.name) !== normalized) continue;
    await item.parent.removeEntry(item.name);
    removed += 1;
  }
  log(`Removed ${removed} file(s) by extension ${extension}.`);
}

async function removeSelectedExtensions() {
  if (!state.outDir) throw new Error('Pick output folder first.');
  const checks = [...els.leftovers.querySelectorAll('input[type="checkbox"][data-ext]:checked')];
  if (checks.length === 0) {
    throw new Error('Select at least one extension in leftovers list.');
  }

  const selected = new Set(checks.map((el) => el.getAttribute('data-ext')));
  const unpackRoot = await getDirIfExists(state.outDir, ['unpacked']);
  if (!unpackRoot) {
    log('No unpacked folder yet. Nothing to remove.');
    return;
  }
  let removed = 0;

  for await (const item of walkFiles(unpackRoot)) {
    if (!selected.has(ext(item.name))) continue;
    await item.parent.removeEntry(item.name);
    removed += 1;
  }

  log(`Removed ${removed} file(s) for selected extension(s): ${[...selected].join(', ')}`);
}

async function removeEmptyDirs() {
  if (!state.outDir) throw new Error('Pick output folder first.');
  const unpackRoot = await getDirIfExists(state.outDir, ['unpacked']);
  if (!unpackRoot) {
    log('No unpacked folder yet. Nothing to clean.');
    return;
  }

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
  log('Created takeout-sample.zip from fixture source.');
}

async function unpackMissing() {
  const unpackRoot = await ensureDir(state.outDir, ['unpacked']);
  const { zips } = await analyzeStatus();
  let unpackedNow = 0;
  let pendingCount = 0;
  for (const item of zips) {
    const base = item.name.replace(/\.zip$/i, '');
    const maybe = await getDirIfExists(unpackRoot, [base]);
    if (!maybe) pendingCount += 1;
  }
  let handled = 0;

  for (const item of zips) {
    const base = item.name.replace(/\.zip$/i, '');
    const maybe = await getDirIfExists(unpackRoot, [base]);
    if (maybe) continue;

    const target = await ensureDir(unpackRoot, [base]);
    log(`Unpacking ${item.name}...`);
    await unpackOneZip(item.handle, target, (p) => {
      els.step2Progress.textContent = `Progress: ${handled + 1}/${Math.max(pendingCount, 1)} ZIPs | ${p.zipLabel} ${p.pct}%`;
    }, item.name);
    handled += 1;
    unpackedNow += 1;
  }

  log(`Unpacked ${unpackedNow} zip(s).`);
  els.step2Progress.textContent = pendingCount > 0 ? 'Progress: complete' : 'Progress: nothing to unpack';
}

async function run(action) {
  try {
    els.log.textContent ||= '';
    await action();
    await refreshPipelineView();
  } catch (e) {
    log(`ERROR: ${e.message || e}`);
  }
}

els.pickZipDir.addEventListener('click', () => run(async () => {
  await pickZipDir();
}));

els.pickOutDir.addEventListener('click', () => run(async () => {
  await pickOutDir();
}));

els.stepPickZipDir.addEventListener('click', () => run(async () => {
  await pickZipDir();
}));

els.stepPickOutDir.addEventListener('click', () => run(async () => {
  await pickOutDir();
}));

async function pickZipDir() {
  state.zipDir = await window.showDirectoryPicker({ mode: 'readwrite' });
  setPipelinePosition(1, 'Pick Source + Destination');
  await setPersistedValue(HANDLE_ZIP_KEY, state.zipDir);
  await persistStateFile();
  refreshStep1Details('State: saved');
  els.zipDirLabel.textContent = `ZIP source: ${displayPathFromHandle(state.zipDir)}`;
  log(`Selected ZIP source: ${state.zipDir.name}`);
}

async function pickOutDir() {
  state.outDir = await window.showDirectoryPicker({ mode: 'readwrite' });
  setPipelinePosition(1, 'Pick Source + Destination');
  await setPersistedValue(HANDLE_OUT_KEY, state.outDir);
  await persistStateFile();
  refreshStep1Details('State: saved');
  els.outDirLabel.textContent = `Output root: ${displayPathFromHandle(state.outDir)}`;
  log(`Selected output root: ${state.outDir.name}`);
}

els.scan.addEventListener('click', () => run(async () => {
  setPipelinePosition(2, 'Unpack ZIPs');
  await persistStateFile();
  await refreshPipelineView();
  log('Status scan complete.');
}));

els.buildFixture.addEventListener('click', () => run(async () => {
  setPipelinePosition(2, 'Unpack ZIPs');
  await persistStateFile();
  await buildFixtureZip();
}));
els.unpackMissing.addEventListener('click', () => run(async () => {
  setPipelinePosition(2, 'Unpack ZIPs');
  await persistStateFile();
  await unpackMissing();
}));
els.stepUnpackBtn.addEventListener('click', () => run(async () => {
  setPipelinePosition(2, 'Unpack ZIPs');
  await persistStateFile();
  await unpackMissing();
}));
els.stepFlattenBtn.addEventListener('click', () => run(async () => {
  setPipelinePosition(3, 'Flatten Files');
  await persistStateFile();
  await flattenSelectedFiles();
}));
els.stepFlattenBtnMirror.addEventListener('click', () => run(async () => {
  setPipelinePosition(3, 'Flatten Files');
  await persistStateFile();
  await flattenSelectedFiles();
}));
els.analyzeLeftovers.addEventListener('click', () => run(async () => {
  setPipelinePosition(5, 'Clean Leftovers');
  await persistStateFile();
  await analyzeLeftoversOnly();
  log('Leftovers analysis complete.');
}));
els.removeByExt.addEventListener('click', () => run(async () => {
  setPipelinePosition(5, 'Clean Leftovers');
  await persistStateFile();
  await removeByExtensionPrompt();
}));
els.removeSelectedExt.addEventListener('click', () => run(async () => {
  setPipelinePosition(5, 'Clean Leftovers');
  await persistStateFile();
  await removeSelectedExtensions();
}));
els.removeEmpty.addEventListener('click', () => run(async () => {
  setPipelinePosition(5, 'Clean Leftovers');
  await persistStateFile();
  await removeEmptyDirs();
}));

els.resetState.addEventListener('click', () => run(async () => {
  if (!window.confirm('Reset remembered folders and pipeline state?')) return;
  await clearPersistedValue(HANDLE_ZIP_KEY);
  await clearPersistedValue(HANDLE_OUT_KEY);
  try {
    await fetch('/api/state', { method: 'DELETE' });
  } catch {
    // keep going even if local api reset fails
  }
  state.zipDir = null;
  state.outDir = null;
  state.lastExtCounts = new Map();
  state.lastTotalLeft = 0;
  setPipelinePosition(1, 'Pick Source + Destination');
  els.zipDirLabel.textContent = 'ZIP source: not selected';
  els.outDirLabel.textContent = 'Output root: not selected';
  els.leftovers.textContent = 'No analysis yet.';
  els.zipTotal.textContent = '0';
  els.zipUnpacked.textContent = '0';
  els.zipPending.textContent = '0';
  refreshStep1Details('State: reset');
  log('State reset. Pick folders again.');
}));

els.clearStep1.addEventListener('click', () => run(async () => {
  if (!window.confirm('Clear Step 1 state (selected folders + saved handles)?')) return;
  await clearPersistedValue(HANDLE_ZIP_KEY);
  await clearPersistedValue(HANDLE_OUT_KEY);
  state.zipDir = null;
  state.outDir = null;
  setPipelinePosition(1, 'Pick Source + Destination');
  await persistStateFile();
  els.zipDirLabel.textContent = 'ZIP source: not selected';
  els.outDirLabel.textContent = 'Output root: not selected';
  refreshStep1Details('State: step 1 cleared');
  log('Step 1 cleared.');
}));

els.clearStep2.addEventListener('click', () => run(async () => {
  if (!state.outDir) throw new Error('Pick output folder first.');
  if (!window.confirm('Clear Step 2 unpacked state? This will delete output/unpacked.')) return;
  await removeSubdir(state.outDir, 'unpacked');
  await ensureDir(state.outDir, ['unpacked']);
  setPipelinePosition(2, 'Unpack ZIPs');
  await persistStateFile();
  log('Step 2 cleared: unpacked folder reset.');
}));

els.clearStep3.addEventListener('click', () => run(async () => {
  if (!state.outDir) throw new Error('Pick output folder first.');
  if (!window.confirm('Clear Step 3 state? This will delete output/photos and output/videos.')) return;
  await removeSubdir(state.outDir, 'photos');
  await removeSubdir(state.outDir, 'videos');
  await ensureDir(state.outDir, ['photos']);
  await ensureDir(state.outDir, ['videos']);
  setPipelinePosition(3, 'Flatten Files');
  await persistStateFile();
  log('Step 3 cleared: photos/videos folders reset.');
}));

els.clearStep4.addEventListener('click', () => run(async () => {
  els.step3TypeImages.checked = true;
  els.step3TypeVideos.checked = true;
  setPipelinePosition(4, 'Type Selection Notes');
  await persistStateFile();
  log('Step 4 cleared: Step 3 type checkboxes reset to images + videos.');
}));

els.clearStep5.addEventListener('click', () => run(async () => {
  state.lastExtCounts = new Map();
  state.lastTotalLeft = 0;
  els.leftovers.textContent = 'No analysis yet.';
  setPipelinePosition(5, 'Clean Leftovers');
  await persistStateFile();
  log('Step 5 cleared: leftovers analysis state reset.');
}));

async function init() {
  try {
    const saved = await loadServerState();
    if (saved && Number.isInteger(saved.pipelinePosition)) {
      state.pipelinePosition = saved.pipelinePosition;
      state.pipelineLabel = saved.pipelineLabel || state.pipelineLabel;
    }

    state.zipDir = await getPersistedValue(HANDLE_ZIP_KEY);
    state.outDir = await getPersistedValue(HANDLE_OUT_KEY);
    if (state.zipDir) {
      els.zipDirLabel.textContent = `ZIP source: ${displayPathFromHandle(state.zipDir)}`;
    }
    if (state.outDir) {
      els.outDirLabel.textContent = `Output root: ${displayPathFromHandle(state.outDir)}`;
    }
    if (state.zipDir || state.outDir) {
      refreshStep1Details('State: restored from previous session');
      log('Restored remembered folder selection from previous session.');
    } else {
      refreshStep1Details('State: not saved yet');
    }
  } catch {
    refreshStep1Details('State: restore failed');
    log('Could not restore persisted folder handles. Please pick folders.');
  }

  await refreshPipelineView().catch(() => {});
  log('Ready. Step 1: pick ZIP source and output folders.');
}

init();
