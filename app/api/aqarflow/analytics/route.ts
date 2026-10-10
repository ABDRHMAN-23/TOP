import { NextResponse } from 'next/server';
import { getAqarFlowAnalyticsContext } from '@/lib/aqarflow/analytics-context';
import { parseAqarFlowAnalyticsPeriod } from '@/lib/aqarflow/analytics-period';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request) {
  const period = parseAqarFlowAnalyticsPeriod(new URL(request.url).searchParams);
  if (!period.ok) return response({ error: period.error }, 400);

  const context = await getAqarFlowAnalyticsContext();
  if (!context.ok) return response({ error: context.error }, context.status);

  const { data, error } = await context.admin.rpc('aqarflow_sales_analytics', {
    p_owner_user_id: context.ownerId,
    p_from: period.value.from,
    p_to: period.value.to,
  });

  if (error) {
    return response({ error: 'تعذر إنشاء التقرير. تحقق من تطبيق هجرة المستوى الرابع.' }, 503);
  }
  return response({ ...data, period: { ...data.period, days: period.value.days, label: period.value.label } });
}
