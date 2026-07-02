import fs from 'node:fs/promises';
import { CLI_LOG, LOG_DIR } from './constants.js';

const EMAIL_PATTERN = /applyAuthResult:\s*email=([^\s,]+@[^\s,]+)|OAuth:\s*authenticated successfully as\s*([^\s,]+@[^\s,]+)|authenticated successfully as\s*([^\s,]+@[^\s,]+)/gi;

export function extractAccountEmail(text) {
  let latest = null;
  for (const match of text.matchAll(EMAIL_PATTERN)) {
    latest = (match[1] || match[2] || match[3]).trim();
  }
  return latest;
}

async function readIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}

export async function detectActiveAccount() {
  const chunks = [await readIfExists(CLI_LOG)];
  try {
    const entries = await fs.readdir(LOG_DIR, { withFileTypes: true });
    const logFiles = entries
      .filter(entry => entry.isFile() && /^cli-.*\.log$/i.test(entry.name))
      .map(entry => `${LOG_DIR}/${entry.name}`)
      .slice(-10);
    const logs = await Promise.all(logFiles.map(readIfExists));
    chunks.push(...logs);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return extractAccountEmail(chunks.join('\n'));
}
