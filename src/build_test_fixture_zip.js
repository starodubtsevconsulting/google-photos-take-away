#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { walkFiles } = require('./lib/common');

function buildFixtureZip() {
  const repoDir = path.resolve(__dirname, '..');
  const sourceDir = path.join(repoDir, 'test/src/source/takeout-sample');
  const zipPath = path.join(repoDir, 'test/src/takeout-sample.zip');

  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    throw new Error(`Missing source fixture directory: ${sourceDir}`);
  }

  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  if (fs.existsSync(zipPath)) {
    fs.rmSync(zipPath, { force: true });
  }

  const fileArgs = walkFiles(sourceDir)
    .map((file) => path.relative(sourceDir, file))
    .sort((a, b) => a.localeCompare(b));

  const result = spawnSync('zip', ['-X', '-q', zipPath, ...fileArgs], {
    cwd: sourceDir,
    encoding: 'utf8',
  });

  if (result.error || result.status !== 0) {
    throw new Error(result.stderr || result.error?.message || 'zip command failed');
  }

  console.log(`Created fixture zip: ${zipPath}`);
}

if (require.main === module) {
  try {
    buildFixtureZip();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = { buildFixtureZip };
