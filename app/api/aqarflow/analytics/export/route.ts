import { NextResponse } from 'next/server';
import { getAqarFlowAnalyticsContext } from '@/lib/aqarflow/analytics-context';
import { parseAqarFlowAnalyticsPeriod } from '@/lib/aqarflow/analytics-period';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const columns: Array<{ key: string; label: string }> = [
  { key: 'created_at', label: 'تاريخ التسجيل' },
  { key: 'display_name', label: 'اسم العميل' },
  { key: 'phone_number', label: 'رقم الهاتف' },
  { key: 'source', label: 'المصدر' },
  { key: 'lead_stage', label: 'مرحلة البيع' },
  { key: 'intent', label: 'النية' },
  { key: 'lead_score', label: 'درجة التأهيل' },
  { key: 'budget_min', label: 'الميزانية الدنيا' },
  { key: 'budget_max', label: 'الميزانية العليا' },
  { key: 'budget_currency', label: 'العملة' },
  { key: 'preferred_area', label: 'المنطقة المفضلة' },
  { key: 'preferred_property_type', label: 'نوع العقار المفضل' },
  { key: 'next_follow_up_at', label: 'موعد المتابعة' },
  { key: 'last_seen_at', label: 'آخر نشاط' },
];

function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  // Prevent spreadsheet formula injection from user-controlled CRM strings.
  if (/^[\t\r ]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request) {
  const period = parseAqarFlowAnalyticsPeriod(new URL(request.url).searchParams);
  if (!period.ok) return errorResponse(period.error, 400);

  const context = await getAqarFlowAnalyticsContext();
  if (!context.ok) return errorResponse(context.error, context.status);

  const { data, error } = await context.admin.rpc('aqarflow_export_sales_analytics', {
    p_owner_user_id: context.ownerId,
    p_from: period.value.from,
    p_to: period.value.to,
  });
  if (error || !data || typeof data !== 'object' || !Array.isArray(data.rows)) {
    return errorResponse('تعذر تصدير التقرير. تحقق من تطبيق هجرة المستوى الرابع.', 503);
  }

  const records = data.rows as Array<Record<string, unknown>>;
  const csv = [
    columns.map(column => csvCell(column.label)).join(','),
    ...records.map(record => columns.map(column => csvCell(record[column.key])).join(',')),
  ].join('\r\n');

  return new Response('\uFEFF' + csv + '\r\n', {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="aqarflow-sales-report.csv"',
      'Cache-Control': 'no-store',
      'X-AqarFlow-Export-Truncated': data.truncated ? 'true' : 'false',
      'X-AqarFlow-Export-Rows': String(records.length),
    },
  });
}
