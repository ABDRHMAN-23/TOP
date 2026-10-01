import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { data, error } = await supabase.from('business_profiles').select('*').eq('user_id', user.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || {
    business_name: '',
    logo_url: '',
    primary_color: '#1769E0',
    phone: '',
    email: user.email || '',
    website: '',
    address: '',
    vat_number: '',
    default_currency: 'GBP',
    default_language: 'en',
    payment_terms: '',
    warranty_terms: ''
  });
}

export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const body = await req.json();
  const payload = {
    user_id: user.id,
    business_name: String(body.business_name || '').trim() || 'My Business',
    logo_url: String(body.logo_url || '').trim() || null,
    primary_color: /^#[0-9A-Fa-f]{6}$/.test(body.primary_color || '') ? body.primary_color : '#1769E0',
    phone: String(body.phone || '').trim() || null,
    email: String(body.email || user.email || '').trim() || null,
    website: String(body.website || '').trim() || null,
    address: String(body.address || '').trim() || null,
    vat_number: String(body.vat_number || '').trim() || null,
    default_currency: String(body.default_currency || 'GBP'),
    default_language: String(body.default_language || 'en'),
    payment_terms: String(body.payment_terms || '').trim() || null,
    warranty_terms: String(body.warranty_terms || '').trim() || null
  };

  const { data, error } = await supabase.from('business_profiles').upsert(payload, { onConflict: 'user_id' }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
