import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const admin = createAdminClient();
  let body:any; try{body=await req.json()}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400})}
  const token=String(body.token||'').trim();
  if(!token) return NextResponse.json({error:'Invalid quote link.'},{status:400});
  const {data:quote,error}=await admin.from('quotes').select('id,status,accepted_at').eq('public_token',token).maybeSingle();
  if(error||!quote) return NextResponse.json({error:'Quote not found.'},{status:404});
  if(quote.status==='accepted') return NextResponse.json({status:'accepted',accepted_at:quote.accepted_at});
  const acceptedAt=new Date().toISOString();
  const {data,error:updateError}=await admin.from('quotes').update({status:'accepted',accepted_at:acceptedAt,updated_at:acceptedAt}).eq('id',quote.id).neq('status','accepted').select('status,accepted_at').single();
  if(updateError) return NextResponse.json({error:updateError.message},{status:400});
  return NextResponse.json(data);
}
