import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
export async function GET(req:Request){
 const ua=req.headers.get('user-agent')||''; const secret=process.env.CRON_SECRET;
 if(secret && req.headers.get('authorization')!==`Bearer ${secret}` && !ua.includes('vercel-cron/1.0')) return NextResponse.json({error:'Unauthorized'},{status:401});
 const admin=createAdminClient(); const now=new Date().toISOString();
 const {data,error}=await admin.from('followups').update({status:'done',sent_at:now}).eq('status','pending').lte('scheduled_for',now).select('id');
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({ok:true,processed:data?.length||0});
}