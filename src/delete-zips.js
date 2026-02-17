#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { drawProgress, finishProgress } = require('./lib/common');

function removeZipFiles(zips) {
  console.log('');
  console.log('Removing zip files...');
  const total = zips.length;
  zips.forEach((zip, idx) => {
    if (total > 0) {
      drawProgress(idx + 1, total);
    }
    try {
      fs.rmSync(path.resolve(zip), { force: true });
    } catch {
      // Keep parity with shell behavior; ignore per-file failures.
    }
  });
  if (total > 0) finishProgress();
}

module.exports = { removeZipFiles };
