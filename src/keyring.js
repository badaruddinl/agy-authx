import { spawnSync } from 'node:child_process';
import { AGY_ACCOUNT, AGY_SERVICE, SNAPSHOT_SERVICE } from './constants.js';
import {
  deleteWindowsCredential,
  listWindowsCredentials,
  readWindowsCredential,
  writeWindowsCredential,
} from './windows-keyring.js';

export class KeyringError extends Error {
  constructor(message) {
    super(message);
    this.name = 'KeyringError';
  }
}

export async function readAgyCredential() {
  const password = readCredential(AGY_SERVICE, AGY_ACCOUNT);
  if (!password) {
    throw new KeyringError(`Credential not found: service=${AGY_SERVICE}, account=${AGY_ACCOUNT}`);
  }
  return password;
}

export async function writeAgyCredential(secret) {
  if (!secret) {
    throw new KeyringError('Refusing to write an empty AGY credential.');
  }
  writeCredential(AGY_SERVICE, AGY_ACCOUNT, secret);
}

export async function deleteAgyCredential() {
  return deleteCredential(AGY_SERVICE, AGY_ACCOUNT);
}

export async function saveSnapshot(accountKey, secret) {
  if (!accountKey) {
    throw new KeyringError('Snapshot account key is required.');
  }
  if (!secret) {
    throw new KeyringError('Refusing to save an empty snapshot credential.');
  }
  writeCredential(SNAPSHOT_SERVICE, accountKey, secret);
}

export async function readSnapshot(accountKey) {
  const secret = readCredential(SNAPSHOT_SERVICE, accountKey);
  if (!secret) {
    throw new KeyringError(`Snapshot credential not found for ${accountKey}.`);
  }
  return secret;
}

export async function deleteSnapshot(accountKey) {
  return deleteCredential(SNAPSHOT_SERVICE, accountKey);
}

export async function listSnapshots({ knownAccountKeys = [] } = {}) {
  return listCredentials(SNAPSHOT_SERVICE, { knownAccountKeys })
    .map(account => ({ account, password: null }));
}

function readCredential(service, account) {
  if (process.platform === 'win32') return readWindowsCredential(windowsTargetName(service, account));
  if (process.platform === 'darwin') return readMacCredential(service, account);
  return readLinuxCredential(service, account);
}

function writeCredential(service, account, secret) {
  if (process.platform === 'win32') {
    writeWindowsCredential(windowsTargetName(service, account), account, secret);
    return;
  }
  if (process.platform === 'darwin') {
    runRequired('security', ['add-generic-password', '-U', '-s', service, '-a', account, '-w', secret]);
    return;
  }
  runRequired('secret-tool', ['store', '--label', `${service} ${account}`, 'service', service, 'account', account], {
    input: secret,
  });
}

function deleteCredential(service, account) {
  if (process.platform === 'win32') return deleteWindowsCredential(windowsTargetName(service, account));
  if (process.platform === 'darwin') {
    const result = spawnSync('security', ['delete-generic-password', '-s', service, '-a', account], {
      encoding: 'utf8',
      windowsHide: true,
    });
    return result.status === 0 || /could not be found|not found/i.test(`${result.stdout}\n${result.stderr}`);
  }
  const result = spawnSync('secret-tool', ['clear', 'service', service, 'account', account], {
    encoding: 'utf8',
    windowsHide: true,
  });
  return result.status === 0 || /not found/i.test(`${result.stdout}\n${result.stderr}`);
}

function listCredentials(service, options = {}) {
  if (process.platform === 'win32') {
    const prefix = `${service}/`;
    return listWindowsCredentials(`${prefix}*`)
      .map(item => item.targetName.startsWith(prefix) ? item.targetName.slice(prefix.length) : '')
      .filter(Boolean);
  }
  if (process.platform === 'darwin') return listMacCredentials(service, options.knownAccountKeys || []);
  return listLinuxCredentials(service);
}

function readMacCredential(service, account) {
  const result = spawnSync('security', ['find-generic-password', '-s', service, '-a', account, '-w'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status === 0) return result.stdout.replace(/\r?\n$/, '');
  if (/could not be found|not found/i.test(`${result.stdout}\n${result.stderr}`)) return null;
  throw new KeyringError(formatCommandError('security', result));
}

function listMacCredentials(service, knownAccountKeys) {
  return [...new Set(knownAccountKeys)]
    .filter(account => hasMacCredential(service, account));
}

function hasMacCredential(service, account) {
  if (!account) return false;
  const result = spawnSync('security', ['find-generic-password', '-s', service, '-a', account], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status === 0) return true;
  if (/could not be found|not found/i.test(`${result.stdout}\n${result.stderr}`)) return false;
  throw new KeyringError(formatCommandError('security', result));
}

function readLinuxCredential(service, account) {
  const result = spawnSync('secret-tool', ['lookup', 'service', service, 'account', account], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status === 0) return result.stdout.replace(/\r?\n$/, '');
  if (result.error?.code === 'ENOENT') {
    throw new KeyringError('Linux keyring requires `secret-tool` from libsecret.');
  }
  if (!result.stdout && !result.stderr) return null;
  throw new KeyringError(formatCommandError('secret-tool', result));
}

function listLinuxCredentials(service) {
  const result = spawnSync('secret-tool', ['search', '--all', 'service', service], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) {
    if (result.error?.code === 'ENOENT') throw new KeyringError('Linux keyring requires `secret-tool` from libsecret.');
    return [];
  }
  return [...result.stdout.matchAll(/(?:attribute\.)?account\s*=\s*([^\n]+)/g)]
    .map(match => match[1].trim())
    .filter(Boolean);
}

function runRequired(command, args, options = {}) {
  const result = spawnSync(command, args, {
    ...options,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) throw new KeyringError(formatCommandError(command, result));
}

function windowsTargetName(service, account) {
  if (service === AGY_SERVICE && account === AGY_ACCOUNT) return service;
  return `${service}/${account}`;
}

function formatCommandError(command, result) {
  if (result.error?.code === 'ENOENT') return `Command not found: ${command}`;
  const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
  return output || `${command} exited with ${result.status}`;
}

