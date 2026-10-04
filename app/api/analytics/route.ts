import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function errorResponse(stage: string, error: unknown, status = 500) {
  return NextResponse.json({
    error: error instanceof Error ? error.message : 'Could not load analytics.',
    stage,
  }, { status });
}

export async function GET() {
  try {
    let supabase;
    try {
      supabase = await createClient();
    } catch (error) {
      return errorResponse('supabase_client', error);
    }

    let user;
    try {
      const result = await supabase.auth.getUser();
      user = result.data.user;
      if (result.error && !user) return errorResponse('auth', result.error);
    } catch (error) {
      return errorResponse('auth', error);
    }

    if (!user) return errorResponse('auth', new Error('Authentication required'), 401);

    let workspaceOwnerId = user.id;
    try {
      const result = await supabase
        .from('team_memberships')
        .select('owner_id')
        .eq('member_id', user.id)
        .neq('owner_id', user.id)
        .maybeSingle();

      if (result.error) return errorResponse('team_memberships', result.error);
      if (result.data?.owner_id) workspaceOwnerId = result.data.owner_id;
    } catch (error) {
      return errorResponse('team_memberships', error);
    }

    const since = new Date();
    since.setDate(since.getDate() - 30);

    let quotes;
    try {
      const result = await supabase
        .from('quotes')
        .select('id,quote_number,client_name,total,currency,status,created_at')
        .eq('user_id', workspaceOwnerId)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(200);

      if (result.error) return errorResponse('quotes', result.error, 400);
      quotes = result.data;
    } catch (error) {
      return errorResponse('quotes', error);
    }

    const rows = quotes || [];
    const totalQuotes = rows.length;
    const accepted = rows.filter((q: any) => q.status === 'accepted').length;
    const sent = rows.filter((q: any) =>
      ['sent', 'viewed', 'accepted', 'rejected'].includes(q.status)
    ).length;
    const revenue = rows
      .filter((q: any) => q.status === 'accepted')
      .reduce((sum: number, q: any) => sum + Number(q.total || 0), 0);

    return NextResponse.json({
      periodDays: 30,
      metrics: { totalQuotes, sent, accepted, revenue },
      quotes: rows,
    });
  } catch (error) {
    return errorResponse('unexpected', error);
  }
}
