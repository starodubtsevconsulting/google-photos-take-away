#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildFixtureZip } = require('./build_test_fixture_zip');
const { moveFilesFlat } = require('./move_files_flat');
const { walkFiles } = require('./lib/common');

function smokeTestFixture() {
  const repoDir = path.resolve(__dirname, '..');
  const srcDir = path.join(repoDir, 'test/src');
  const distDir = path.join(repoDir, 'test/dist');
  const unpackRoot = path.join(distDir, 'unpacked');
  const photosDir = path.join(distDir, 'flat/photos');
  const videosDir = path.join(distDir, 'flat/videos');

  buildFixtureZip();

  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(unpackRoot, { recursive: true });
  fs.mkdirSync(path.join(distDir, 'flat'), { recursive: true });

  const zips = fs
    .readdirSync(srcDir)
    .filter((name) => name.toLowerCase().endsWith('.zip'))
    .sort((a, b) => a.localeCompare(b));

  if (zips.length < 2) {
    throw new Error(`Smoke test expects multiple fixture zips in test/src, got ${zips.length}`);
  }

  for (const zipName of zips) {
    const zipPath = path.join(srcDir, zipName);
    const base = zipName.replace(/\.zip$/i, '');
    const unpackDir = path.join(unpackRoot, base);
    const unzipResult = spawnSync('unzip', ['-q', zipPath, '-d', unpackDir], { encoding: 'utf8' });
    if (unzipResult.error || unzipResult.status !== 0) {
      throw new Error(unzipResult.stderr || unzipResult.error?.message || `unzip failed for ${zipName}`);
    }
  }

  moveFilesFlat(unpackRoot, photosDir, false, 'image');
  moveFilesFlat(unpackRoot, videosDir, false, 'video');

  const photoCount = walkFiles(photosDir).length;
  const videoCount = walkFiles(videosDir).length;

  if (photoCount !== 4) {
    throw new Error(`Smoke test failed: expected 4 photos, got ${photoCount}`);
  }

  if (videoCount !== 3) {
    throw new Error(`Smoke test failed: expected 3 videos, got ${videoCount}`);
  }

  if (!fs.existsSync(path.join(photosDir, 'IMG_0001-1.JPG'))) {
    throw new Error('Smoke test failed: collision rename IMG_0001-1.JPG not found');
  }

  console.log(`Smoke test passed. Photos=${photoCount} Videos=${videoCount}`);
  console.log(`Artifacts are in: ${distDir}`);
}

if (require.main === module) {
  try {
    smokeTestFixture();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = { smokeTestFixture };
