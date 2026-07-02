import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.join(__dirname, 'windows-write-credential.ps1');

export function writeWindowsGenericCredential(service, account, secret) {
  const encodedSecret = Buffer.from(secret, 'utf8').toString('base64');
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      SCRIPT_PATH,
      '-TargetName',
      service,
      '-UserName',
      account,
    ],
    {
      input: encodedSecret,
      encoding: 'utf8',
      windowsHide: true,
    },
  );
  if (result.status !== 0) {
    const message = result.stderr || result.stdout || `PowerShell exited with ${result.status}`;
    throw new Error(`Failed to write Windows credential: ${message.trim()}`);
  }
}
