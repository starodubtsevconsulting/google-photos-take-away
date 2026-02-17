#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { drawProgress, finishProgress, truncateLabel } = require('./lib/common');

function zipEntryCount(zipFile) {
  const check = spawnSync('zipinfo', ['-1', zipFile], { encoding: 'utf8' });
  if (check.error || check.status !== 0) {
    return null;
  }
  const lines = check.stdout.split('\n').filter(Boolean);
  return lines.length;
}

function unzipWithProgress(zipFile, destination) {
  const total = zipEntryCount(zipFile);
  const result = spawnSync('unzip', ['-o', zipFile, '-d', destination], { encoding: 'utf8' });

  if (result.error) {
    return { ok: false, code: 1, stderr: result.error.message };
  }

  if (total && total > 0) {
    const lines = result.stdout.split('\n').filter(Boolean);
    let count = 0;
    for (const line of lines) {
      count += 1;
      const entry = truncateLabel(path.basename(line.replace(/^.*:\s*/, '').trim()) || path.basename(zipFile));
      drawProgress(Math.min(count, total), total, entry);
    }
    finishProgress();
  }

  return { ok: result.status === 0, code: result.status || 0, stderr: result.stderr };
}

function unpackMissingZips(notUnpacked, options = {}) {
  const outputRoot = options.outputRoot || process.cwd();
  console.log('');
  console.log('Unpacking missing zips...');

  for (const zip of notUnpacked) {
    const base = zip.replace(/\.zip$/i, '');
    const destination = path.join(outputRoot, base);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    console.log(`  -> ${zip}`);
    const out = unzipWithProgress(zip, destination);
    if (!out.ok) {
      console.log(`  ! Unzip failed (rc=${out.code}) for ${zip}`);
      if (out.stderr) {
        process.stdout.write(String(out.stderr));
      }
    }
  }
}

module.exports = { unpackMissingZips };
