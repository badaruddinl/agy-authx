import { VERSION, AGY_ACCOUNT, AGY_SERVICE, REGISTRY_PATH, SNAPSHOT_SERVICE } from './constants.js';
import { detectActiveAccount } from './agy.js';
import { printAccounts, printJson } from './format.js';
import {
  deleteSnapshot,
  listNativeAgyCredentials,
  readAgyCredential,
  readSnapshot,
  saveSnapshot,
  writeAgyCredential,
} from './keyring.js';
import { defaultRegistry, findAccount, readRegistry, slug, upsertAccount, writeRegistry } from './registry.js';

function help() {
  console.log(`agy-auth ${VERSION}`);
  console.log('');
  console.log('Local Google Antigravity account switcher for agy CLI.');
  console.log('');
  console.log('Commands:');
  console.log('  status                  Show active AGY account and registry status');
  console.log('  import [--alias name]   Capture current AGY keyring credential');
  console.log('  list                    List captured accounts');
  console.log('  switch <query>          Restore captured account by email/alias/key');
  console.log('  remove <query|--all>    Remove captured snapshots');
  console.log('  native                  List native AGY keyring entries without secrets');
  console.log('  config                  Show keyring service configuration');
  console.log('  --version, -V           Show version');
  console.log('');
  console.log('Options:');
  console.log('  --json                  Print JSON output');
  console.log('');
  console.log('Install: npm install -g @badaruddinl/agy-auth');
}

function parseAlias(args) {
  const index = args.indexOf('--alias');
  if (index < 0) return '';
  if (!args[index + 1]) throw new Error('--alias requires a value.');
  return args[index + 1];
}

async function status(jsonMode) {
  const registry = await readRegistry();
  const email = await detectActiveAccount();
  const payload = {
    version: VERSION,
    activeAccountEmail: email,
    registryPath: REGISTRY_PATH,
    capturedAccounts: registry.accounts.length,
    activeAccountKey: registry.activeAccountKey,
    agyService: AGY_SERVICE,
    agyAccount: AGY_ACCOUNT,
    snapshotService: SNAPSHOT_SERVICE,
  };
  if (jsonMode) {
    printJson(payload);
  } else {
    console.log(`active account: ${email || '-'}`);
    console.log(`captured accounts: ${registry.accounts.length}`);
    console.log(`active account key: ${registry.activeAccountKey || '-'}`);
    console.log(`agy credential: service=${AGY_SERVICE}, account=${AGY_ACCOUNT}`);
    console.log(`registry: ${REGISTRY_PATH}`);
  }
  return email ? 0 : 1;
}

async function importAccount(args, jsonMode) {
  const alias = parseAlias(args);
  const email = await detectActiveAccount();
  if (!email) {
    throw new Error('Active AGY email was not detected. Open agy, finish login, then run `agy-auth import`.');
  }
  const secret = await readAgyCredential();
  const accountKey = slug(email);
  await saveSnapshot(accountKey, secret);

  const registry = await readRegistry();
  const previous = registry.accounts.find(account => account.accountKey === accountKey);
  const account = upsertAccount(registry, {
    accountKey,
    email,
    alias: alias || previous?.alias || '',
    createdAt: previous?.createdAt || new Date().toISOString(),
    importedAt: new Date().toISOString(),
    usedAt: new Date().toISOString(),
  });
  registry.activeAccountKey = accountKey;
  await writeRegistry(registry);

  if (jsonMode) printJson({ ok: true, account, registryPath: REGISTRY_PATH });
  else console.log(`Captured AGY account: ${email}`);
  return 0;
}

async function list(jsonMode) {
  const registry = await readRegistry();
  if (jsonMode) printJson(registry);
  else printAccounts(registry);
  return registry.accounts.length ? 0 : 1;
}

async function switchAccount(query, jsonMode) {
  if (!query) {
    await list(jsonMode);
    return 1;
  }
  const registry = await readRegistry();
  const { account, matches } = findAccount(registry, query);
  if (matches.length > 1) {
    if (jsonMode) printJson({ ok: false, error: 'Query matched multiple accounts.', matches });
    else console.log('Query matched multiple accounts. Use a more specific email, alias, or key.');
    return 2;
  }
  if (!account) {
    if (jsonMode) printJson({ ok: false, error: 'No captured account matched.', query });
    else console.log('No captured account matched.');
    return 1;
  }

  const secret = await readSnapshot(account.accountKey);
  await writeAgyCredential(secret);
  account.usedAt = new Date().toISOString();
  registry.activeAccountKey = account.accountKey;
  upsertAccount(registry, account);
  await writeRegistry(registry);

  if (jsonMode) printJson({ ok: true, account, restartRequired: true });
  else {
    console.log(`Switched AGY credential to: ${account.email}`);
    console.log('Restart running AGY CLI/App sessions so they reload the credential.');
  }
  return 0;
}

async function remove(args, jsonMode) {
  const registry = await readRegistry();
  const targets = args[0] === '--all'
    ? registry.accounts
    : findAccount(registry, args[0]).matches;
  if (targets.length === 0) {
    if (jsonMode) printJson({ ok: false, error: 'No captured account matched.' });
    else console.log('No captured account matched.');
    return 1;
  }

  const keys = new Set(targets.map(account => account.accountKey));
  await Promise.all([...keys].map(deleteSnapshot));
  registry.accounts = registry.accounts.filter(account => !keys.has(account.accountKey));
  if (keys.has(registry.activeAccountKey)) registry.activeAccountKey = null;
  await writeRegistry(registry);

  if (jsonMode) printJson({ ok: true, removed: [...keys] });
  else console.log(`Removed ${keys.size} captured account(s).`);
  return 0;
}

async function native(jsonMode) {
  const credentials = await listNativeAgyCredentials();
  const safe = credentials.map(item => ({ account: item.account }));
  if (jsonMode) printJson({ service: AGY_SERVICE, credentials: safe });
  else {
    console.log(`AGY native service: ${AGY_SERVICE}`);
    for (const item of safe) console.log(`- ${item.account}`);
    if (safe.length === 0) console.log('- no entries found');
  }
  return safe.length ? 0 : 1;
}

function config(jsonMode) {
  const payload = {
    agyService: AGY_SERVICE,
    agyAccount: AGY_ACCOUNT,
    snapshotService: SNAPSHOT_SERVICE,
    registryPath: REGISTRY_PATH,
  };
  if (jsonMode) printJson(payload);
  else {
    console.log(`agy service: ${AGY_SERVICE}`);
    console.log(`agy account: ${AGY_ACCOUNT}`);
    console.log(`snapshot service: ${SNAPSHOT_SERVICE}`);
    console.log(`registry: ${REGISTRY_PATH}`);
  }
  return 0;
}

export async function run(argv) {
  const args = [...argv];
  const jsonMode = args.includes('--json');
  const filtered = args.filter(arg => arg !== '--json');
  const command = filtered[0] || 'help';
  const rest = filtered.slice(1);

  if (command === 'help' || command === '--help' || command === '-h') {
    help();
    return 0;
  }
  if (command === '--version' || command === '-V') {
    console.log(`agy-auth ${VERSION}`);
    return 0;
  }
  if (command === 'status') return status(jsonMode);
  if (command === 'import') return importAccount(rest, jsonMode);
  if (command === 'list') return list(jsonMode);
  if (command === 'switch') return switchAccount(rest[0], jsonMode);
  if (command === 'remove') return remove(rest, jsonMode);
  if (command === 'native') return native(jsonMode);
  if (command === 'config') return config(jsonMode);

  console.error(`Unknown command: ${command}`);
  console.error('Run `agy-auth --help`.');
  return 2;
}

export const internals = {
  defaultRegistry,
  findAccount,
  parseAlias,
  slug,
  upsertAccount,
};
