import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return NextResponse.json({ error: 'Email sending is not configured yet.' }, { status: 503 });
  }
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }
  const id = String(body.id || '');
  const { data: quote, error } = await supabase.from('quotes').select('id,quote_number,client_name,client_email,total,currency,public_token').eq('id', id).eq('user_id', user.id).single();
  if (error || !quote?.client_email) return NextResponse.json({ error: 'A client email is required.' }, { status: 400 });
  const origin = new URL(req.url).origin;
  const link = origin + '/q/' + quote.public_token;
  const business = await supabase.from('business_profiles').select('business_name,email').eq('user_id', user.id).maybeSingle();
  const senderName = business.data?.business_name || 'QUVOTO';
  const html = '<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#0A1E3D"><h2 style="margin-bottom:4px">'+senderName+'</h2><p>Hi '+(quote.client_name || 'there')+',</p><p>Your quotation <strong>'+quote.quote_number+'</strong> is ready to review.</p><p><strong>'+quote.currency+' '+Number(quote.total || 0).toFixed(2)+'</strong></p><p><a href="'+link+'" style="display:inline-block;background:#1769E0;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">View quotation</a></p><p style="color:#64748b">You can view the quotation online and download the PDF.</p></div>';
  const resend = await fetch('https://api.resend.com/emails', { method:'POST', headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'}, body:JSON.stringify({from:process.env.RESEND_FROM_EMAIL,to:[quote.client_email],subject:'Quotation '+quote.quote_number+' from '+senderName,html}) });
  if (!resend.ok) {
    const detail = await resend.text();
    return NextResponse.json({ error: 'Email provider rejected the message.', detail: detail.slice(0,300) }, { status: 502 });
  }
  await supabase.from('quotes').update({ status:'sent', sent_at:new Date().toISOString(), updated_at:new Date().toISOString() }).eq('id', id).eq('user_id', user.id);
  return NextResponse.json({ ok:true, status:'sent', recipient:quote.client_email });
}
