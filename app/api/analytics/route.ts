import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data: quotes, error } = await supabase
      .from('quotes')
      .select('id,quote_number,client_name,total,currency,status,created_at')
      .eq('user_id', user.id)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const rows = quotes || [];
    const totalQuotes = rows.length;
    const accepted = rows.filter((q: any) => q.status === 'accepted').length;
    const sent = rows.filter((q: any) => ['sent','viewed','accepted','rejected'].includes(q.status)).length;
    const revenue = rows
      .filter((q: any) => q.status === 'accepted')
      .reduce((sum: number, q: any) => sum + Number(q.total || 0), 0);

    return NextResponse.json({
      periodDays: 30,
      metrics: { totalQuotes, sent, accepted, revenue },
      quotes: rows
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load analytics.' }, { status: 500 });
  }
}
