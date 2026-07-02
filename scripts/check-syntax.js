#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const roots = ['bin', 'src', 'test', 'scripts'];

function collectFiles(root) {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.flatMap(entry => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) return collectFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.js') ? [fullPath] : [];
  });
}

const files = roots.flatMap(root => (fs.existsSync(root) ? collectFiles(root) : []));
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
