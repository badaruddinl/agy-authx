import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const LEGACY_PACKAGE = '@badaruddinl/agy-auth';
export const AUTHX_PACKAGE = '@badaruddinl/agy-authx';
export const LEGACY_BRIDGE_VERSION = '0.1.17';

const execFileAsync = promisify(execFile);

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

async function defaultRunner(command, args) {
  const result = await execFileAsync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function normalizeAction(action = 'status') {
  if (action === 'enabled') return 'enable';
  if (action === 'disabled') return 'disable';
  if (['status', 'enable', 'disable'].includes(action)) return action;
  throw new Error('Usage: agy-authx legacy <status|enable|disable>');
}

function parseGlobalPackage(text, packageName = LEGACY_PACKAGE) {
  const payload = JSON.parse(text || '{}');
  const item = payload.dependencies?.[packageName];
  if (!item) {
    return {
      installed: false,
      packageName,
      version: '',
      managedBridge: false,
    };
  }

  const version = item.version || '';
  return {
    installed: true,
    packageName,
    version,
    managedBridge: version === LEGACY_BRIDGE_VERSION,
    invalid: Boolean(item.invalid),
    problems: item.problems || [],
  };
}

async function readLegacyBridge(runner = defaultRunner) {
  try {
    const result = await runner(npmCommand(), ['ls', '-g', LEGACY_PACKAGE, '--depth=0', '--json']);
    return parseGlobalPackage(result.stdout, LEGACY_PACKAGE);
  } catch (error) {
    if (error?.stdout) return parseGlobalPackage(error.stdout, LEGACY_PACKAGE);
    return {
      installed: false,
      packageName: LEGACY_PACKAGE,
      version: '',
      managedBridge: false,
    };
  }
}

function assertManagedLegacyBridge(legacy) {
  if (!legacy.installed) return;
  if (legacy.version === LEGACY_BRIDGE_VERSION) return;
  throw new Error(
    `Refusing to modify ${LEGACY_PACKAGE}@${legacy.version}. `
    + `Only ${LEGACY_PACKAGE}@${LEGACY_BRIDGE_VERSION} is managed by this command.`,
  );
}

async function uninstallLegacyBridge(runner = defaultRunner) {
  return runner(npmCommand(), ['uninstall', '-g', LEGACY_PACKAGE]);
}

async function installAuthx(version, runner = defaultRunner) {
  return runner(npmCommand(), ['install', '-g', `${AUTHX_PACKAGE}@${version}`]);
}

function printLegacyResult(payload, jsonMode, output = console.log) {
  if (jsonMode) {
    output(JSON.stringify(payload, null, 2));
    return;
  }

  if (payload.action === 'status') {
    output(`legacy bridge: ${payload.installed ? `${payload.packageName}@${payload.version}` : 'not installed'}`);
    output(`managed      : ${payload.managedBridge ? 'yes' : 'no'}`);
    output(`agy-auth cmd : provided by ${AUTHX_PACKAGE}@${payload.authxVersion} when installed globally`);
    return;
  }

  if (payload.action === 'disable') {
    if (payload.removed) output(`removed ${LEGACY_PACKAGE}@${LEGACY_BRIDGE_VERSION}`);
    else output(`${LEGACY_PACKAGE}@${LEGACY_BRIDGE_VERSION} is not installed`);
    output(`agy-auth cmd should come from ${AUTHX_PACKAGE}@${payload.authxVersion}`);
    return;
  }

  if (payload.action === 'enable') {
    if (payload.removed) output(`removed ${LEGACY_PACKAGE}@${LEGACY_BRIDGE_VERSION}`);
    output(`installed ${AUTHX_PACKAGE}@${payload.authxVersion}`);
    output('agy-auth cmd is enabled through agy-authx');
  }
}

export async function runLegacyCommand(args, options = {}) {
  const action = normalizeAction(args[0] || 'status');
  const jsonMode = Boolean(options.jsonMode);
  const runner = options.runner || defaultRunner;
  const output = options.output || console.log;
  const authxVersion = options.authxVersion || '0.0.0';
  const legacy = await readLegacyBridge(runner);
  assertManagedLegacyBridge(legacy);

  const payload = {
    ok: true,
    action,
    packageName: LEGACY_PACKAGE,
    bridgeVersion: LEGACY_BRIDGE_VERSION,
    authxPackage: AUTHX_PACKAGE,
    authxVersion,
    installed: legacy.installed,
    version: legacy.version || null,
    managedBridge: legacy.managedBridge,
    removed: false,
    installedAuthx: false,
  };

  if (action === 'disable' && legacy.installed) {
    await uninstallLegacyBridge(runner);
    payload.removed = true;
  }

  if (action === 'enable') {
    if (legacy.installed) {
      await uninstallLegacyBridge(runner);
      payload.removed = true;
    }
    await installAuthx(authxVersion, runner);
    payload.installedAuthx = true;
  }

  printLegacyResult(payload, jsonMode, output);
  return 0;
}

export const internals = {
  assertManagedLegacyBridge,
  installAuthx,
  normalizeAction,
  npmCommand,
  parseGlobalPackage,
  printLegacyResult,
  readLegacyBridge,
  uninstallLegacyBridge,
};
