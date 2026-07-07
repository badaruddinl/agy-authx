export function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

export function printAccounts(registry, options = {}) {
  const accounts = registry.accounts || [];
  const width = terminalWidth(options.columns);
  const layout = accountListLayout(width);
  console.log(renderAccountHeader(layout, width));
  console.log('-'.repeat(width));
  if (accounts.length === 0) {
    console.log(fitText('  -- no AGY sessions saved; run `agy-authx login`', width));
    return;
  }
  for (const [index, account] of accounts.entries()) {
    const active = account.accountKey === registry.activeAccountKey;
    const marker = active ? '*' : ' ';
    const alias = account.alias || '-';
    const auth = account.hasSnapshot === false
      ? (account.isActiveCredential ? 'current' : 'missing')
      : 'yes';
    const usage = formatUsageColumns(account.usage);
    const refreshed = formatLastRefresh(account.usageAt || account.usage?.capturedAt);
    const compact = formatCompactUsage(account.usage);
    const row = renderAccountRow(layout, width, {
      marker,
      number: String(index + 1).padStart(2, '0'),
      account: String(account.email || account.accountKey || '-'),
      alias,
      auth,
      authShort: shortAuth(auth),
      geminiFiveHour: usage.geminiFiveHour,
      geminiWeekly: usage.geminiWeekly,
      otherFiveHour: usage.otherFiveHour,
      otherWeekly: usage.otherWeekly,
      geminiPair: compact.gemini,
      otherPair: compact.other,
      refreshed,
    });
    console.log(active ? highlightActiveRow(row, options) : row);
  }
}

function terminalWidth(value) {
  const width = Number(value || process.stdout.columns || 120);
  if (!Number.isFinite(width)) return 120;
  return Math.max(48, Math.min(Math.floor(width), 180));
}

function accountListLayout(width) {
  if (width >= 134) {
    return {
      kind: 'full',
      columns: [
        ['marker', '', 1],
        ['number', '#', 2, 'right'],
        ['account', 'ACCOUNT', flexWidth(width, [1, 2, 12, 8, 18, 22, 18, 22, 12], 8, 31)],
        ['alias', 'ALIAS', 12],
        ['auth', 'AUTH', 8],
        ['geminiFiveHour', 'GEMINI 5H', 18],
        ['geminiWeekly', 'GEMINI WEEKLY', 22],
        ['otherFiveHour', 'OTHER 5H', 18],
        ['otherWeekly', 'OTHER WEEKLY', 22],
        ['refreshed', 'LAST REFRESH', 12],
      ],
    };
  }
  if (width >= 100) {
    return {
      kind: 'medium',
      columns: [
        ['marker', '', 1],
        ['number', '#', 2, 'right'],
        ['account', 'ACCOUNT', flexWidth(width, [1, 2, 10, 7, 11, 13, 11, 13, 8], 8, 34)],
        ['alias', 'ALIAS', 10],
        ['auth', 'AUTH', 7],
        ['geminiFiveHour', 'G5H', 11],
        ['geminiWeekly', 'GWEEK', 13],
        ['otherFiveHour', 'O5H', 11],
        ['otherWeekly', 'OWEEK', 13],
        ['refreshed', 'REFRESH', 8],
      ],
    };
  }
  if (width >= 76) {
    return {
      kind: 'compact',
      columns: [
        ['marker', '', 1],
        ['number', '#', 2, 'right'],
        ['account', 'ACCOUNT', flexWidth(width, [1, 2, 8, 7, 11, 11, 8], 8, 28)],
        ['alias', 'ALIAS', 8],
        ['auth', 'AUTH', 7],
        ['geminiPair', 'GEM 5/W', 11],
        ['otherPair', 'OTH 5/W', 11],
        ['refreshed', 'REF', 8],
      ],
    };
  }
  return {
    kind: 'tiny',
    columns: [
      ['marker', '', 1],
      ['number', '#', 2, 'right'],
      ['account', 'ACCOUNT', flexWidth(width, [1, 2, 3, 8, 8], 8, 38)],
      ['authShort', 'A', 3],
      ['geminiPair', 'G 5/W', 8],
      ['otherPair', 'O 5/W', 8],
    ],
  };
}

function flexWidth(totalWidth, fixedWidths, min, max) {
  const spaces = fixedWidths.length;
  const fixed = fixedWidths.reduce((sum, value) => sum + value, 0);
  return Math.max(min, Math.min(max, totalWidth - fixed - spaces));
}

function renderAccountHeader(layout, width) {
  return renderCells(layout.columns.map(column => ({
    value: column[1],
    width: column[2],
    align: column[3],
  })), width);
}

function renderAccountRow(layout, width, row) {
  return renderCells(layout.columns.map(column => ({
    value: row[column[0]],
    width: column[2],
    align: column[3],
  })), width);
}

function renderCells(cells, width) {
  const line = cells
    .map(cell => padCell(cell.value, cell.width, cell.align))
    .join(' ');
  return fitText(line, width);
}

function padCell(value, width, align = 'left') {
  const text = fitText(String(value || ''), width);
  return align === 'right' ? text.padStart(width) : text.padEnd(width);
}

function fitText(value, width) {
  const text = String(value || '');
  if (text.length <= width) return text;
  if (width <= 3) return text.slice(0, width);
  return `${text.slice(0, width - 3)}...`;
}

function shortAuth(value) {
  if (value === 'current') return 'cur';
  if (value === 'missing') return 'mis';
  return value === 'yes' ? 'ok' : fitText(value, 3);
}

function formatCompactUsage(usage) {
  const groups = Array.isArray(usage?.groups) ? usage.groups : [];
  const gemini = groups.find(group => /gemini/i.test(group.name)) || null;
  const other = groups.find(group => /claude|gpt/i.test(group.name)) || null;
  return {
    gemini: formatUsagePair(gemini),
    other: formatUsagePair(other),
  };
}

function formatUsagePair(group) {
  if (!group) return '-/-';
  return `${formatPercent(group.fiveHour)}/${formatPercent(group.weekly)}`;
}

function formatPercent(limit) {
  if (!limit) return '-';
  return Number.isFinite(limit.remainingPercent) ? `${limit.remainingPercent}%` : '?';
}

function highlightActiveRow(row, options = {}) {
  if (!shouldUseColor(options)) return row;
  return `\x1b[1;36m${row}\x1b[0m`;
}

function shouldUseColor(options = {}) {
  if (options.color === false) return false;
  if (options.color === true) return true;
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== '0') return true;
  return Boolean(process.stdout.isTTY);
}

export function formatUsageColumns(usage) {
  const groups = Array.isArray(usage?.groups) ? usage.groups : [];
  const gemini = groups.find(group => /gemini/i.test(group.name)) || null;
  const other = groups.find(group => /claude|gpt/i.test(group.name)) || null;
  const capturedAt = usage?.capturedAt || new Date().toISOString();
  return {
    geminiFiveHour: formatLimit(gemini?.fiveHour, capturedAt),
    geminiWeekly: formatLimit(gemini?.weekly, capturedAt),
    otherFiveHour: formatLimit(other?.fiveHour, capturedAt),
    otherWeekly: formatLimit(other?.weekly, capturedAt),
  };
}

function formatLimit(limit, capturedAt) {
  if (!limit) return '-';
  const percent = Number.isFinite(limit.remainingPercent) ? `${limit.remainingPercent}%` : '?';
  const resetAt = formatResetAt(limit.refreshesIn, capturedAt);
  return resetAt ? `${percent} (${resetAt})` : percent;
}

export function formatMinQuota(usage) {
  const groups = Array.isArray(usage?.groups) ? usage.groups : [];
  const values = groups.flatMap(group => [
    group.weekly?.remainingPercent,
    group.fiveHour?.remainingPercent,
  ]).filter(Number.isFinite);
  if (values.length === 0) return '-';
  return `${Math.min(...values)}% min`;
}

export function formatFirstReset(usage) {
  const groups = Array.isArray(usage?.groups) ? usage.groups : [];
  const resets = groups.flatMap(group => [
    group.weekly?.refreshesIn,
    group.fiveHour?.refreshesIn,
  ]).filter(Boolean);
  return resets[0] || '-';
}

export function formatLastRefresh(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return date.toLocaleString();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatResetAt(refreshesIn, capturedAt) {
  const durationMs = parseRefreshDuration(refreshesIn);
  if (!durationMs) return '';
  const base = new Date(capturedAt);
  if (Number.isNaN(base.getTime())) return '';
  return formatResetDate(new Date(base.getTime() + durationMs), base);
}

export function parseRefreshDuration(value) {
  if (!value) return 0;
  const text = String(value).toLowerCase();
  let totalMinutes = 0;
  const pattern = /(\d+)\s*(d|day|days|h|hr|hrs|hour|hours|m|min|mins|minute|minutes)\b/g;
  for (const match of text.matchAll(pattern)) {
    const amount = Number(match[1]);
    const unit = match[2];
    if (!Number.isFinite(amount)) continue;
    if (unit.startsWith('d')) totalMinutes += amount * 24 * 60;
    else if (unit.startsWith('h')) totalMinutes += amount * 60;
    else if (unit.startsWith('m')) totalMinutes += amount;
  }
  return totalMinutes * 60 * 1000;
}

function formatResetDate(date, baseDate) {
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  if (isSameLocalDay(date, baseDate)) return time;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${time} on ${date.getDate()} ${months[date.getMonth()]}`;
}

function isSameLocalDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}
