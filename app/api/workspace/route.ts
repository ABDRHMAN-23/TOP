import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notifyUser } from '@/lib/notifications';

async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}
function ownerId(userId:string){ return userId; }

export async function GET() {
  const { supabase, user } = await auth();
  if (!user) return NextResponse.json({ error:'Authentication required' }, { status:401 });
  const uid=ownerId(user.id);
  const [customers,savedItems,templates,jobs,followups,referrals,rewards]=await Promise.all([
    supabase.from('customers').select('*').eq('user_id',uid).order('name'),
    supabase.from('saved_items').select('*').eq('user_id',uid).order('description'),
    supabase.from('quote_templates').select('*').eq('user_id',uid).order('name'),
    supabase.from('jobs').select('*').eq('user_id',uid).order('created_at',{ascending:false}),
    supabase.from('followups').select('*,quotes(quote_number,client_name,public_token)').eq('user_id',uid).order('scheduled_for'),
    supabase.from('referrals').select('id,status,qualifying_plan,signed_up_at,subscribed_at,qualified_at,created_at').eq('referrer_user_id',uid).order('created_at',{ascending:false}),
    supabase.from('referral_rewards').select('*').eq('user_id',uid).order('earned_at',{ascending:false})
  ]);
  return NextResponse.json({customers:customers.data||[],savedItems:savedItems.data||[],templates:templates.data||[],jobs:jobs.data||[],followups:followups.data||[],referrals:referrals.data||[],rewards:rewards.data||[]});
}

export async function POST(req:Request) {
  const { supabase, user }=await auth();
  if(!user) return NextResponse.json({error:'Authentication required'},{status:401});
  let b:any; try{b=await req.json()}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400})}
  const uid=user.id, action=String(b.action||'');
  if(action==='customer'){
    const payload={user_id:uid,name:String(b.name||'').trim(),email:String(b.email||'').trim()||null,phone:String(b.phone||'').trim()||null,address:String(b.address||'').trim()||null,updated_at:new Date().toISOString()};
    if(!payload.name)return NextResponse.json({error:'Customer name is required.'},{status:400});
    const {data,error}=await supabase.from('customers').upsert(payload,{onConflict:'user_id,email,phone,name'}).select().single();
    if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json(data);
  }
  if(action==='saved_item'){
    const payload={user_id:uid,description:String(b.description||'').trim(),unit:String(b.unit||'item').trim(),price:Number(b.price||0),currency:String(b.currency||'GBP'),kind:String(b.kind||'material')};
    if(!payload.description)return NextResponse.json({error:'Item description is required.'},{status:400});
    const {data,error}=await supabase.from('saved_items').insert(payload).select().single();
    if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json(data);
  }
  if(action==='template'){
    const payload={user_id:uid,name:String(b.name||'').trim(),items:Array.isArray(b.items)?b.items:[],notes:Array.isArray(b.notes)?b.notes:[],currency:String(b.currency||'GBP')};
    if(!payload.name)return NextResponse.json({error:'Template name is required.'},{status:400});
    const {data,error}=await supabase.from('quote_templates').insert(payload).select().single();
    if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json(data);
  }
  if(action==='followup'){
    const days=Math.max(0,Math.min(365,Number(b.days||3)));
    const scheduled=new Date(Date.now()+days*86400000).toISOString();
    const {data,error}=await supabase.from('followups').insert({user_id:uid,quote_id:String(b.quote_id),scheduled_for:scheduled,channel:String(b.channel||'copy'),note:String(b.note||'Hi, just checking whether you have had a chance to review the quote.')}).select().single();
    if(error)return NextResponse.json({error:error.message},{status:400});
    await notifyUser(uid,{title:'Follow-up scheduled',body:'Your follow-up for '+(data?.scheduled_for?new Date(data.scheduled_for).toLocaleDateString():'the scheduled date')+' is on your QUVOTO list.',type:'followup',link:'/workspace',tag:'followup-scheduled',dedupeKey:data?.id?'followup-scheduled:'+String(data.id):undefined});
    return NextResponse.json(data);
  }
  if(action==='followup_done'){
    const {data,error}=await supabase.from('followups').update({status:'done',sent_at:new Date().toISOString()}).eq('id',String(b.id)).eq('user_id',uid).select().single();
    if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json(data);
  }
  if(action==='job'){
    const quoteId=String(b.quote_id||'');
    const {data:q}=await supabase.from('quotes').select('id,client_name,client_email,client_phone,client_address,total,currency,status,items,notes').eq('id',quoteId).eq('user_id',uid).single();
    if(!q||q.status!=='accepted')return NextResponse.json({error:'Only accepted quotes can become jobs.'},{status:400});
    let customerId:string|null=null;
    if(q.client_name){const {data:c}=await supabase.from('customers').upsert({user_id:uid,name:q.client_name,email:q.client_email,phone:q.client_phone,address:q.client_address,updated_at:new Date().toISOString()},{onConflict:'user_id,email,phone,name'}).select('id').single();customerId=c?.id||null;}
    const {data,error}=await supabase.from('jobs').insert({user_id:uid,customer_id:customerId,quote_id:q.id,title:String(b.title||('Job from '+q.client_name)),description:Array.isArray(q.notes)?q.notes.join('\n'):''}).select().single();
    if(error)return NextResponse.json({error:error.message},{status:400});
    await notifyUser(uid,{title:'Job created',body:(data?.title||'Your accepted quote')+' is now in your QUVOTO jobs.',type:'job_created',link:'/workspace',tag:'job-created',dedupeKey:data?.id?'job-created:'+String(data.id):undefined});
    return NextResponse.json(data);
  }
  if(action==='invoice'){
    const quoteId=String(b.quote_id||'');
    const {data:q}=await supabase.from('quotes').select('id,quote_number,client_name,total,currency,status').eq('id',quoteId).eq('user_id',uid).single();
    if(!q||q.status!=='accepted')return NextResponse.json({error:'Only accepted quotes can become invoices.'},{status:400});
    const invoiceNumber='INV-'+new Date().toISOString().slice(0,7).replace('-','')+'-'+Math.random().toString(36).slice(2,7).toUpperCase();
    const {data,error}=await supabase.from('invoices').insert({user_id:uid,quote_id:q.id,invoice_number:invoiceNumber,amount:q.total,currency:q.currency}).select().single();
    if(error)return NextResponse.json({error:error.message},{status:400});
    await notifyUser(uid,{title:'Invoice created',body:'Invoice '+invoiceNumber+' was created from the accepted quote.',type:'invoice_created',link:'/workspace',tag:'invoice-created',dedupeKey:data?.id?'invoice-created:'+String(data.id):undefined});
    return NextResponse.json(data);
  }
  if(action==='duplicate'){
    const quoteId=String(b.quote_id||'');
    const {data:q}=await supabase.from('quotes').select('client_name,client_email,client_phone,client_address,items,notes,currency,template,language,vat_rate,discount').eq('id',quoteId).eq('user_id',uid).single();
    if(!q)return NextResponse.json({error:'Quote not found.'},{status:404});
    const {data,error}=await supabase.rpc('create_quote',{p_client_name:q.client_name,p_client_email:q.client_email,p_client_phone:q.client_phone,p_client_address:q.client_address,p_items:q.items||[],p_notes:q.notes||[],p_currency:q.currency,p_template:q.template,p_language:q.language,p_vat_rate:q.vat_rate||0,p_discount:q.discount||0}).single();
    if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json(data);
  }
  if(action==='referral_code'){
    const code=(String(user.id).replaceAll('-','').slice(0,6)+'-'+Math.random().toString(36).slice(2,7)).toUpperCase();
    const {data,error}=await supabase.from('referral_codes').upsert({user_id:uid,code,active:true},{onConflict:'user_id'}).select().single();
    if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json(data);
  }
  return NextResponse.json({error:'Unknown action.'},{status:400});
}