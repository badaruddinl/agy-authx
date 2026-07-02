export function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

export function printAccounts(registry) {
  const accounts = registry.accounts || [];
  console.log('     ACCOUNT                         ALIAS        AUTH     GEMINI 5H          GEMINI WEEKLY          OTHER 5H           OTHER WEEKLY           LAST REFRESH');
  console.log('--------------------------------------------------------------------------------------------------------------------------------------------------');
  if (accounts.length === 0) {
    console.log('  -- no AGY sessions saved; run `agy-auth login`');
    return;
  }
  for (const [index, account] of accounts.entries()) {
    const marker = account.accountKey === registry.activeAccountKey ? '*' : ' ';
    const alias = account.alias || '-';
    const auth = account.hasSnapshot === false
      ? (account.isActiveCredential ? 'current' : 'missing')
      : 'yes';
    const usage = formatUsageColumns(account.usage);
    const refreshed = formatLastRefresh(account.usageAt || account.usage?.capturedAt);
    console.log(
      `${marker} ${String(index + 1).padStart(2, '0')} `
      + `${String(account.email || account.accountKey || '-').padEnd(31)} `
      + `${alias.padEnd(12)} `
      + `${auth.padEnd(8)} `
      + `${usage.geminiFiveHour.padEnd(18)} `
      + `${usage.geminiWeekly.padEnd(22)} `
      + `${usage.otherFiveHour.padEnd(18)} `
      + `${usage.otherWeekly.padEnd(22)} `
      + refreshed,
    );
  }
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
