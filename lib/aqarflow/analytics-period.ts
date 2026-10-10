export type AqarFlowAnalyticsPeriod = {
  from: string;
  to: string;
  days: number;
  label: string;
};

export type AqarFlowAnalyticsPeriodResult =
  | { ok: true; value: AqarFlowAnalyticsPeriod }
  | { ok: false; error: string };

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIODS = new Set([7, 30, 90, 365]);

function strictUtcDate(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(value + 'T00:00:00.000Z');
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return null;
  return timestamp;
}

export function parseAqarFlowAnalyticsPeriod(
  params: URLSearchParams,
  nowMs = Date.now(),
): AqarFlowAnalyticsPeriodResult {
  const fromRaw = params.get('from');
  const toRaw = params.get('to');

  if (fromRaw !== null || toRaw !== null) {
    if (!fromRaw || !toRaw) return { ok: false, error: 'أرسل تاريخ البداية والنهاية معًا.' };
    const fromMs = strictUtcDate(fromRaw);
    const toDayMs = strictUtcDate(toRaw);
    if (fromMs === null || toDayMs === null) return { ok: false, error: 'استخدم تاريخًا صحيحًا بصيغة YYYY-MM-DD.' };
    const toExclusiveMs = toDayMs + DAY_MS;
    if (toExclusiveMs <= fromMs) return { ok: false, error: 'تاريخ النهاية يجب ألا يسبق تاريخ البداية.' };
    if (toExclusiveMs > nowMs + DAY_MS) return { ok: false, error: 'لا يمكن اختيار تاريخ نهاية في المستقبل.' };
    const duration = toExclusiveMs - fromMs;
    if (duration > 366 * DAY_MS) return { ok: false, error: 'أقصى فترة مخصصة هي 366 يومًا.' };
    const days = Math.max(1, Math.ceil(duration / DAY_MS));
    return {
      ok: true,
      value: {
        from: new Date(fromMs).toISOString(),
        to: new Date(toExclusiveMs).toISOString(),
        days,
        label: `من ${fromRaw} إلى ${toRaw}`,
      },
    };
  }

  const requestedDays = Number(params.get('days') || 30);
  if (!PERIODS.has(requestedDays)) {
    return { ok: false, error: 'اختر فترة 7 أو 30 أو 90 أو 365 يومًا.' };
  }
  return {
    ok: true,
    value: {
      from: new Date(nowMs - requestedDays * DAY_MS).toISOString(),
      to: new Date(nowMs).toISOString(),
      days: requestedDays,
      label: `آخر ${requestedDays} يومًا`,
    },
  };
}
