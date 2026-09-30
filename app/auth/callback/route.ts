import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/app';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const user = data.user;
      await supabase.from('profiles').upsert({
        id: user.id,
        email: user.email ?? null,
        updated_at: new Date().toISOString()
      });
      await supabase.from('subscriptions').upsert({
        user_id: user.id,
        plan: 'free',
        status: 'active'
      }, { onConflict: 'user_id' });

      const month = new Date();
      month.setUTCDate(1);
      await supabase.from('usage').upsert({
        user_id: user.id,
        period_start: month.toISOString().slice(0, 10),
        quotes_count: 0,
        voice_minutes: 0,
        pdf_count: 0
      }, { onConflict: 'user_id,period_start', ignoreDuplicates: true });

      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth', url.origin));
}
