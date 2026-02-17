#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { walkFiles } = require('./lib/common');

function buildFixtureZips() {
  const repoDir = path.resolve(__dirname, '..');
  const sourceRoot = path.join(repoDir, 'test/src/source');
  const zipRoot = path.join(repoDir, 'test/src');

  if (!fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) {
    throw new Error(`Missing source fixture root: ${sourceRoot}`);
  }

  const fixtureDirs = fs
    .readdirSync(sourceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  if (fixtureDirs.length === 0) {
    throw new Error(`No fixture directories found under: ${sourceRoot}`);
  }

  fs.mkdirSync(zipRoot, { recursive: true });

  const created = [];
  for (const dirName of fixtureDirs) {
    const sourceDir = path.join(sourceRoot, dirName);
    const zipPath = path.join(zipRoot, `${dirName}.zip`);

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
      throw new Error(result.stderr || result.error?.message || `zip command failed for ${dirName}`);
    }

    created.push(zipPath);
    console.log(`Created fixture zip: ${zipPath}`);
  }

  return created;
}

function buildFixtureZip() {
  return buildFixtureZips();
}

if (require.main === module) {
  try {
    buildFixtureZip();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = { buildFixtureZip, buildFixtureZips };
