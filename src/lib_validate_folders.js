#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ask, drawProgress, finishProgress, isYes, truncateLabel } = require('./lib/common');
const { removeZipFiles } = require('./delete-zips');

function folderFileCount(dir) {
  let count = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    let stat;
    try {
      stat = fs.statSync(current);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      const children = fs.readdirSync(current).map((name) => path.join(current, name));
      for (const child of children) stack.push(child);
    } else if (stat.isFile()) {
      count += 1;
    }
  }
  return count;
}

function folderSize(dir) {
  const result = spawnSync('du', ['-sb', dir], { encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
  const token = result.stdout.trim().split(/\s+/)[0];
  const parsed = Number(token);
  return Number.isFinite(parsed) ? parsed : null;
}

async function validateUnpackedFolders(unpacked) {
  console.log('');
  console.log('Validation:');
  console.log('-----------');

  const total = unpacked.length;
  if (total === 0) {
    console.log('');
    console.log('Result:');
    console.log('-------');
    console.log('Folders with data : 0');
    console.log('Empty folders     : 0');
    console.log('');
    return;
  }

  let ok = 0;
  let empty = 0;
  const sizeThreshold = 0.7;
  const sizeReport = [];
  const sizeWarningNames = [];
  const sizeWarningZips = [];

  unpacked.forEach((zip, idx) => {
    const base = zip.replace(/\.zip$/i, '');
    const fileCount = folderFileCount(base);
    drawProgress(idx + 1, total, truncateLabel(path.basename(base)));
    if (fileCount > 0) ok += 1;
    else empty += 1;

    if (fs.existsSync(zip)) {
      const zipSize = fs.statSync(zip).size;
      const dirSize = folderSize(base);
      if (zipSize > 0 && dirSize !== null) {
        const ratio = dirSize / zipSize;
        sizeReport.push({ name: base, zipSize, dirSize, ratio });
        if (ratio < sizeThreshold) {
          sizeWarningNames.push(base);
          sizeWarningZips.push(zip);
        }
      }
    }
  });

  finishProgress();

  console.log('');
  console.log('Result:');
  console.log('-------');
  console.log(`Folders with data : ${ok}`);
  console.log(`Empty folders     : ${empty}`);
  console.log('');

  if (sizeWarningZips.length > 0) {
    console.log('Size check:');
    console.log('-----------');
    console.log(`Zip size vs folder size (ratio < ${sizeThreshold} flagged)`);
    sizeReport.forEach((entry) => {
      if (entry.ratio < sizeThreshold) {
        console.log(`  ${path.basename(entry.name)} | zip: ${entry.zipSize} bytes | folder: ${entry.dirSize} bytes | ratio: ${entry.ratio.toFixed(2)}  !`);
      }
    });
    console.log(`  Warning: ${sizeWarningZips.length} folder(s) smaller than expected.`);
    console.log('  Check:');
    sizeWarningNames.forEach((name) => {
      const absolute = path.isAbsolute(name) ? name : path.join(process.cwd(), name);
      console.log(`    - ${absolute}`);
    });
    console.log('');
    console.log('Next step:');
    console.log('----------');
    console.log('  1) Re-unzip flagged zips');
    console.log('  2) Continue');
    console.log('');
    const choice = (await ask('Enter choice [1-2]: ')).trim();
    if (choice === '1') {
      console.log('');
      console.log('Re-unzipping flagged zips...');
      for (const warnZip of sizeWarningZips) {
        const base = warnZip.replace(/\.zip$/i, '');
        console.log(`  -> ${warnZip}`);
        spawnSync('unzip', ['-o', warnZip, '-d', base], { stdio: 'inherit' });
      }
    }
    console.log('');
  }

  console.log('Next step:');
  console.log('----------');
  console.log('  1) Remove zip files for validated folders');
  console.log('  2) Back to status');
  console.log('');
  const choice = (await ask('Enter choice [1-2]: ')).trim();
  if (choice === '1' || isYes(choice)) {
    removeZipFiles(unpacked);
  }
}

module.exports = { validateUnpackedFolders };
