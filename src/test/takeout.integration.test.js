#!/usr/bin/env node
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repo = path.resolve(__dirname, '..', '..');
const takeoutCli = path.join(repo, 'takeout');
const fixtureBuilder = path.join(repo, 'src', 'build_test_fixture_zip.js');
const moveFilesFlatCli = path.join(repo, 'src', 'move_files_flat.js');
const removeByExtCli = path.join(repo, 'src', 'remove_files_by_extension.js');
const removeEmptyCli = path.join(repo, 'src', 'remove_empty_folders.js');

const srcDir = path.join(repo, 'test', 'src');
const distDir = path.join(repo, 'test', 'dist');
const unpackRoot = path.join(distDir, 'unpacked');
const photosDir = path.join(distDir, 'photos');
const videosDir = path.join(distDir, 'videos');

function run(cmd, args, opts = {}) {
  const out = spawnSync(cmd, args, {
    cwd: repo,
    encoding: 'utf8',
    ...opts,
  });

  if (out.status !== 0) {
    throw new Error(
      [
        `Command failed: ${cmd} ${(args || []).join(' ')}`,
        `status=${out.status}`,
        `stdout:\n${out.stdout || ''}`,
        `stderr:\n${out.stderr || ''}`,
      ].join('\n')
    );
  }

  return out;
}

function resetDist() {
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });
}

function countFiles(root) {
  if (!fs.existsSync(root)) return 0;
  let count = 0;
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(current)) {
        stack.push(path.join(current, child));
      }
    } else if (stat.isFile()) {
      count += 1;
    }
  }
  return count;
}

test('integration: build fixture zip in test/src', () => {
  resetDist();
  run('node', [fixtureBuilder]);

  const zipPath = path.join(srcDir, 'takeout-sample.zip');
  assert.equal(fs.existsSync(zipPath), true, 'fixture zip should exist');
  assert.ok(fs.statSync(zipPath).size > 0, 'fixture zip should be non-empty');
});

test('integration: takeout option 2 unpacks into test/dist/unpacked', () => {
  resetDist();
  run('node', [fixtureBuilder]);

  run(takeoutCli, [], { input: '2\n8\n' });

  const unpackedDir = path.join(unpackRoot, 'takeout-sample');
  assert.equal(fs.existsSync(unpackedDir), true, 'unpacked folder should exist');
  assert.ok(countFiles(unpackedDir) >= 5, 'unpacked folder should contain files');
});

test('integration: takeout options 3 and 4 move photos/videos to test/dist', () => {
  resetDist();
  run('node', [fixtureBuilder]);

  run(takeoutCli, [], { input: '2\n8\n' });
  run('node', [moveFilesFlatCli, '--src', unpackRoot, '--dst', photosDir, '--type', 'image']);
  run('node', [moveFilesFlatCli, '--src', unpackRoot, '--dst', videosDir, '--type', 'video']);

  assert.equal(countFiles(photosDir), 3, 'should move 3 photo files');
  assert.equal(countFiles(videosDir), 2, 'should move 2 video files');
  assert.equal(fs.existsSync(path.join(photosDir, 'IMG_0001-1.JPG')), true, 'should rename duplicate photo');
});

test('integration: remove_files_by_extension removes .json metadata files', () => {
  resetDist();
  run('node', [fixtureBuilder]);
  run(takeoutCli, [], { input: '2\n8\n' });

  const unpackedDir = path.join(unpackRoot, 'takeout-sample');
  const jsonPath = path.join(unpackedDir, 'Album-2', 'meta.json');
  assert.equal(fs.existsSync(jsonPath), true, 'meta.json should exist before removal');

  run('node', [removeByExtCli, '--root', unpackRoot, '--ext', '.json']);

  assert.equal(fs.existsSync(jsonPath), false, 'meta.json should be removed');
});

test('integration: remove_empty_folders removes empty directories after cleanup', () => {
  resetDist();
  run('node', [fixtureBuilder]);
  run(takeoutCli, [], { input: '2\n8\n' });

  const emptyDir = path.join(unpackRoot, 'to-delete-empty-dir');
  fs.mkdirSync(emptyDir, { recursive: true });
  assert.equal(fs.existsSync(emptyDir), true, 'empty directory should exist before cleanup');

  run('node', [removeEmptyCli, '--root', unpackRoot]);

  assert.equal(fs.existsSync(emptyDir), false, 'empty directory should be removed');
});
