import assert from 'node:assert/strict';
import { parseAqarFlowAnalyticsPeriod } from '../lib/aqarflow/analytics-period.ts';

const now = Date.parse('2026-10-10T12:00:00.000Z');
const defaultPeriod = parseAqarFlowAnalyticsPeriod(new URLSearchParams('days=30'), now);
assert.equal(defaultPeriod.ok, true);
if (defaultPeriod.ok) {
  assert.equal(Date.parse(defaultPeriod.value.to), now);
  assert.equal(Date.parse(defaultPeriod.value.to) - Date.parse(defaultPeriod.value.from), 30 * 86400000);
}

const custom = parseAqarFlowAnalyticsPeriod(new URLSearchParams('from=2026-10-01&to=2026-10-10'), now);
assert.equal(custom.ok, true);
if (custom.ok) {
  assert.equal(custom.value.days, 10);
  assert.equal(custom.value.to, '2026-10-11T00:00:00.000Z');
}

assert.equal(parseAqarFlowAnalyticsPeriod(new URLSearchParams('from=2026-02-30&to=2026-03-01'), now).ok, false);
assert.equal(parseAqarFlowAnalyticsPeriod(new URLSearchParams('from=2026-10-11&to=2026-10-10'), now).ok, false);
assert.equal(parseAqarFlowAnalyticsPeriod(new URLSearchParams('from=2025-10-09&to=2026-10-10'), now).ok, false);
assert.equal(parseAqarFlowAnalyticsPeriod(new URLSearchParams('days=14'), now).ok, false);
assert.equal(parseAqarFlowAnalyticsPeriod(new URLSearchParams('from=2026-10-01'), now).ok, false);

console.log('AqarFlow analytics date range tests passed.');
