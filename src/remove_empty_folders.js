#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { parseArgs, drawProgress, finishProgress, truncateLabel, walkFiles, extFromFile, ask } = require('./lib/common');

const DEFAULT_ROOT = '/media/USER/DRIVE/takeout';

function findEmptyDirs(root) {
  const dirs = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    let stat;
    try {
      stat = fs.statSync(current);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;

    const children = fs.readdirSync(current).map((name) => path.join(current, name));
    for (const child of children) {
      stack.push(child);
    }
    dirs.push(current);
  }
  dirs.sort((a, b) => b.length - a.length);
  return dirs.filter((dir) => fs.readdirSync(dir).length === 0);
}

function topExtensions(root, limit = 10) {
  const out = [];
  const seen = new Set();
  for (const file of walkFiles(root)) {
    const ext = extFromFile(file);
    if (!seen.has(ext)) {
      seen.add(ext);
      out.push(ext);
      if (out.length >= limit) break;
    }
  }
  return out;
}

function nonEmptyDirCount(root) {
  let count = 0;
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    let stat;
    try {
      stat = fs.statSync(current);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;

    const children = fs.readdirSync(current).map((name) => path.join(current, name));
    if (children.length > 0) count += 1;
    for (const child of children) stack.push(child);
  }
  return count;
}

function removeEmptyFolders(root) {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Directory not found: ${root}`);
  }

  console.log('');
  console.log(`Removing empty folders in: ${root}`);

  let removed = 0;
  let failed = 0;
  let pass = 0;

  while (true) {
    const empties = findEmptyDirs(root).filter((dir) => path.resolve(dir) !== path.resolve(root));
    if (empties.length === 0) {
      if (pass === 0) {
        console.log('No empty folders found.');
      }
      break;
    }

    pass += 1;
    let removedThisPass = 0;

    empties.forEach((dir, idx) => {
      try {
        fs.rmdirSync(dir);
        removed += 1;
        removedThisPass += 1;
      } catch {
        failed += 1;
      }
      drawProgress(idx + 1, empties.length, truncateLabel(path.basename(dir)));
    });
    finishProgress();

    if (removedThisPass === 0) {
      break;
    }
  }

  console.log(`Removed ${removed} empty folder(s).`);
  if (failed > 0) {
    console.log(`Failed to remove ${failed} empty folder(s).`);
  }

  const remaining = nonEmptyDirCount(root);
  if (remaining > 0) {
    console.log(`Not removed (non-empty) folder(s): ${remaining}`);
    console.log('Top file extensions in remaining folders (up to 10):');
    topExtensions(root, 10).forEach((ext) => console.log(`  ${ext}`));
  }

  return { remaining, extensions: topExtensions(root, 10) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let rootDir = args.root;
  const summary = Boolean(args.summary);

  if (!rootDir) {
    const input = await ask(`Root folder to clean empty directories [${DEFAULT_ROOT}]: `);
    rootDir = input.trim() || DEFAULT_ROOT;
  }

  const result = removeEmptyFolders(rootDir);

  if (summary) {
    console.log(`REMAINING=${result.remaining}`);
    console.log(`EXTENSIONS=${result.extensions.join(',')}`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { removeEmptyFolders };
