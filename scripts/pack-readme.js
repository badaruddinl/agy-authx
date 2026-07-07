#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const mode = process.argv[2] || '';
const readmePath = path.join(root, 'README.md');
const npmReadmePath = path.join(root, 'scripts', 'npm-readme.md');
const backupPath = path.join(root, '.README.github.md.tmp');

if (mode === 'prepack') {
  if (!fs.existsSync(npmReadmePath)) process.exit(0);
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(readmePath, backupPath);
  }
  fs.copyFileSync(npmReadmePath, readmePath);
  process.exit(0);
}

if (mode === 'postpack') {
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, readmePath);
    fs.rmSync(backupPath);
  }
  process.exit(0);
}

console.error('Usage: node scripts/pack-readme.js <prepack|postpack>');
process.exit(2);
