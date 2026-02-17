#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { parseArgs, drawProgress, finishProgress, truncateLabel, walkFiles, ask } = require('./lib/common');

const DEFAULT_SRC = '/media/USER/DRIVE/takeout';
const DEFAULT_DST = '/media/USER/DRIVE/takeout/photos';

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.heic', '.heif', '.webp', '.tiff', '.tif', '.bmp', '.dng', '.cr2', '.cr3', '.nef', '.arw', '.raf', '.rw2', '.jfif']);
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.mts', '.m2ts', '.3gp', '.3gpp', '.3g2', '.webm', '.mpg', '.mpeg', '.mpe', '.wmv', '.flv', '.dv']);

function allowedExtension(ext, fileType) {
  const lower = ext.toLowerCase();
  if (fileType === 'image') return IMAGE_EXTS.has(lower);
  if (fileType === 'video') return VIDEO_EXTS.has(lower);
  throw new Error(`Unknown --type: ${fileType} (use image or video)`);
}

function validatePaths(srcDir, dstDir) {
  const srcAbs = path.resolve(srcDir);
  const dstAbs = path.resolve(dstDir);
  if (dstAbs === srcAbs || dstAbs.startsWith(`${srcAbs}${path.sep}`)) {
    throw new Error(`Invalid destination: dst must not be inside src.\n  src: ${srcAbs}\n  dst: ${dstAbs}`);
  }
}

function collectFiles(root, destDir, fileType) {
  const files = walkFiles(root, { skipDir: destDir });
  return files.filter((file) => allowedExtension(path.extname(file), fileType));
}

function uniqueTarget(destDir, originalName) {
  const parsed = path.parse(originalName);
  let candidate = path.join(destDir, originalName);
  if (!fs.existsSync(candidate)) return candidate;

  let index = 1;
  while (true) {
    const withSuffix = `${parsed.name}-${index}${parsed.ext}`;
    candidate = path.join(destDir, withSuffix);
    if (!fs.existsSync(candidate)) return candidate;
    index += 1;
  }
}

function moveFilesFlat(root, destDir, dryRun = false, fileType = 'image') {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Directory not found: ${root}`);
  }

  validatePaths(root, destDir);
  fs.mkdirSync(destDir, { recursive: true });

  console.log('');
  console.log(`Moving files to: ${destDir}`);

  const files = collectFiles(root, destDir, fileType);
  if (files.length === 0) {
    console.log('No files found.');
    return;
  }

  let moved = 0;
  files.forEach((file, idx) => {
    const base = path.basename(file);
    const label = truncateLabel(base);
    drawProgress(idx + 1, files.length, label);

    if (dryRun) {
      moved += 1;
      return;
    }

    const target = uniqueTarget(destDir, base);
    fs.renameSync(file, target);
    moved += 1;
  });

  finishProgress();
  if (dryRun) {
    console.log(`Would move ${moved} file(s).`);
  } else {
    console.log(`Moved ${moved} file(s).`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let srcDir = args.src;
  let dstDir = args.dst;
  const dryRun = Boolean(args['dry-run']);
  const fileType = args.type || 'image';

  if (!srcDir) {
    const input = await ask(`Source folder with unpacked takeout [${DEFAULT_SRC}]: `);
    srcDir = input.trim() || DEFAULT_SRC;
  }

  if (!dstDir) {
    const input = await ask(`Destination folder for flat photos [${DEFAULT_DST}]: `);
    dstDir = input.trim() || DEFAULT_DST;
  }

  moveFilesFlat(srcDir, dstDir, dryRun, fileType);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { moveFilesFlat };
