import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
export async function GET(request: Request) {
  const url = new URL(request.url); const code = url.searchParams.get('code');
  if (code && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const jar = await cookies();
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{cookies:{getAll:()=>jar.getAll(),setAll:values=>values.forEach(({name,value,options})=>jar.set(name,value,options))}});
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL('/',url.origin));
}
