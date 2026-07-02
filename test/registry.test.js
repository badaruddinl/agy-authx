import assert from 'node:assert/strict';
import test from 'node:test';
import { extractAccountEmail } from '../src/agy.js';
import { internals } from '../src/cli.js';

test('extracts latest AGY account email from logs', () => {
  const email = extractAccountEmail(`
    OAuth: authenticated successfully as first@example.com
    applyAuthResult: email=writer@example.com, authMethod=consumer
  `);

  assert.equal(email, 'writer@example.com');
});

test('matches accounts by email alias and key', () => {
  const registry = {
    activeAccountKey: 'writer-example.com',
    accounts: [
      { accountKey: 'writer-example.com', email: 'writer@example.com', alias: 'utama' },
      { accountKey: 'backup-example.com', email: 'backup@example.com', alias: 'cadangan' },
    ],
  };

  assert.equal(internals.findAccount(registry, 'utama').account.email, 'writer@example.com');
  assert.equal(internals.findAccount(registry, 'backup@').account.accountKey, 'backup-example.com');
  assert.equal(internals.findAccount(registry, 'example.com').matches.length, 2);
});

test('parses import alias', () => {
  assert.equal(internals.parseAlias(['--alias', 'utama']), 'utama');
  assert.equal(internals.parseAlias([]), '');
  assert.throws(() => internals.parseAlias(['--alias']), /requires a value/);
});

test('installed AGY build does not require device auth support in parser tests', () => {
  assert.equal(typeof internals.supportsAgyDeviceAuth, 'function');
});
