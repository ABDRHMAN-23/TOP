import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const admin = createAdminClient();
  let body:any; try{body=await req.json()}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400})}
  const token=String(body.token||'');
  if(!token) return NextResponse.json({error:'Invalid quote link.'},{status:400});
  const {data:quote,error}=await admin.from('quotes').select('id,status').eq('public_token',token).maybeSingle();
  if(error||!quote) return NextResponse.json({error:'Quote not found.'},{status:404});
  const {data,error:updateError}=await admin.from('quotes').update({status:'accepted',accepted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',quote.id).select('status,accepted_at').single();
  if(updateError) return NextResponse.json({error:updateError.message},{status:400});
  return NextResponse.json(data);
}
