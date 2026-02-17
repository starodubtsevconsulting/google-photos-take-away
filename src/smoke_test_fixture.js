#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildFixtureZip } = require('./build_test_fixture_zip');
const { moveFilesFlat } = require('./move_files_flat');
const { walkFiles } = require('./lib/common');

function smokeTestFixture() {
  const repoDir = path.resolve(__dirname, '..');
  const srcZip = path.join(repoDir, 'test/src/takeout-sample.zip');
  const distDir = path.join(repoDir, 'test/dist');
  const unpackDir = path.join(distDir, 'unpacked/takeout-sample');
  const photosDir = path.join(distDir, 'flat/photos');
  const videosDir = path.join(distDir, 'flat/videos');

  buildFixtureZip();

  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(distDir, 'unpacked'), { recursive: true });
  fs.mkdirSync(path.join(distDir, 'flat'), { recursive: true });

  const unzipResult = spawnSync('unzip', ['-q', srcZip, '-d', unpackDir], { encoding: 'utf8' });
  if (unzipResult.error || unzipResult.status !== 0) {
    throw new Error(unzipResult.stderr || unzipResult.error?.message || 'unzip failed');
  }

  moveFilesFlat(unpackDir, photosDir, false, 'image');
  moveFilesFlat(unpackDir, videosDir, false, 'video');

  const photoCount = walkFiles(photosDir).length;
  const videoCount = walkFiles(videosDir).length;

  if (photoCount !== 3) {
    throw new Error(`Smoke test failed: expected 3 photos, got ${photoCount}`);
  }

  if (videoCount !== 2) {
    throw new Error(`Smoke test failed: expected 2 videos, got ${videoCount}`);
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
