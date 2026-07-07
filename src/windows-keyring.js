import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.join(__dirname, 'windows-write-credential.ps1');

export function readWindowsCredential(targetName) {
  const result = runWindowsCredential(['-Action', 'Read', '-TargetName', targetName]);
  if (result.status === 2) return null;
  ensureSuccess(result, 'read');
  const encoded = result.stdout.trim();
  return encoded ? Buffer.from(encoded, 'base64').toString('utf8') : null;
}

export function writeWindowsCredential(targetName, userName, secret) {
  const encodedSecret = Buffer.from(secret, 'utf8').toString('base64');
  const result = runWindowsCredential(['-Action', 'Write', '-TargetName', targetName, '-UserName', userName], encodedSecret);
  ensureSuccess(result, 'write');
}

export function deleteWindowsCredential(targetName) {
  const result = runWindowsCredential(['-Action', 'Delete', '-TargetName', targetName]);
  if (result.status === 2) return false;
  ensureSuccess(result, 'delete');
  return true;
}

export function listWindowsCredentials(filter) {
  const result = runWindowsCredential(['-Action', 'List', '-Filter', filter]);
  ensureSuccess(result, 'list');
  const parsed = JSON.parse(result.stdout || '[]');
  return Array.isArray(parsed) ? parsed : [parsed];
}

function runWindowsCredential(args, input = '') {
  return spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT_PATH, ...args],
    {
      input,
      encoding: 'utf8',
      windowsHide: true,
    },
  );
}

function ensureSuccess(result, action) {
  if (result.status === 0) return;
  const message = result.stderr || result.stdout || `PowerShell exited with ${result.status}`;
  throw new Error(`Failed to ${action} Windows credential: ${message.trim()}`);
}
