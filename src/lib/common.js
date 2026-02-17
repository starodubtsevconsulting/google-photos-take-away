#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');

function drawProgress(current, total, label = '') {
  const width = 30;
  const safeTotal = total > 0 ? total : 1;
  const filled = Math.floor((current * width) / safeTotal);
  const empty = Math.max(0, width - filled);
  const pct = Math.floor((current * 100) / safeTotal);
  process.stdout.write(`\r  [${'#'.repeat(filled)}${'-'.repeat(empty)}] ${String(pct).padStart(3, ' ')}%${label ? ` ${label}` : ''}`);
}

function finishProgress() {
  process.stdout.write('\n');
}

function truncateLabel(label, max = 40) {
  if (label.length <= max) return label;
  return `...${label.slice(-(max - 3))}`;
}

function walkFiles(rootDir, options = {}) {
  const entries = [];
  const stack = [rootDir];
  const skipDir = options.skipDir ? path.resolve(options.skipDir) : null;

  while (stack.length > 0) {
    const current = stack.pop();
    let stats;
    try {
      stats = fs.statSync(current);
    } catch {
      continue;
    }

    if (stats.isDirectory()) {
      const resolved = path.resolve(current);
      if (skipDir && (resolved === skipDir || resolved.startsWith(`${skipDir}${path.sep}`))) {
        continue;
      }
      const children = fs.readdirSync(current);
      for (const child of children) {
        stack.push(path.join(current, child));
      }
    } else if (stats.isFile()) {
      entries.push(current);
    }
  }

  return entries;
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function isYes(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'y' || normalized === 'yes';
}

function extFromFile(file) {
  const base = path.basename(file);
  if (base.startsWith('.') && !base.slice(1).includes('.')) {
    return '<no-ext>';
  }
  const ext = path.extname(base);
  return ext ? ext.toLowerCase() : '<no-ext>';
}

module.exports = {
  ask,
  drawProgress,
  extFromFile,
  finishProgress,
  isYes,
  parseArgs,
  truncateLabel,
  walkFiles,
};
