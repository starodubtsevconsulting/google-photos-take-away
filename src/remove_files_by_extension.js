#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { parseArgs, drawProgress, finishProgress, truncateLabel, walkFiles, ask } = require('./lib/common');

const DEFAULT_ROOT = '/media/USER/DRIVE/takeout';

function removeFilesByExtension(root, ext, dryRun = false) {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Directory not found: ${root}`);
  }

  if (!ext) {
    throw new Error('Extension is required.');
  }

  if (!ext.startsWith('.')) {
    throw new Error('Extension must start with a dot, e.g. .json');
  }

  console.log('');
  console.log(`Removing files with extension ${ext} in: ${root}`);

  const lowerExt = ext.toLowerCase();
  const files = walkFiles(root).filter((file) => path.extname(file).toLowerCase() === lowerExt);

  if (files.length === 0) {
    console.log('No matching files found.');
    return;
  }

  let removed = 0;
  files.forEach((file, idx) => {
    drawProgress(idx + 1, files.length, truncateLabel(path.basename(file)));
    if (dryRun) return;
    fs.rmSync(file, { force: true });
    removed += 1;
  });

  finishProgress();
  if (dryRun) {
    console.log(`Would remove ${files.length} file(s).`);
  } else {
    console.log(`Removed ${removed} file(s).`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let rootDir = args.root;
  let extension = args.ext;
  const dryRun = Boolean(args['dry-run']);

  if (!rootDir) {
    const input = await ask(`Root folder to remove files from [${DEFAULT_ROOT}]: `);
    rootDir = input.trim() || DEFAULT_ROOT;
  }

  if (!extension) {
    extension = (await ask('File extension to remove (e.g. .json): ')).trim();
  }

  removeFilesByExtension(rootDir, extension, dryRun);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { removeFilesByExtension };
