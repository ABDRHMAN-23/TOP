import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function PATCH(req:Request){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:'Authentication required'},{status:401});
 let b:any;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400})}
 const id=String(b.id||''); if(!id)return NextResponse.json({error:'Quote id required.'},{status:400});
 let customerId=null;
 if(String(b.client_name||'').trim()){
   const {data:c}=await supabase.from('customers').upsert({user_id:user.id,name:String(b.client_name).trim(),email:String(b.client_email||'').trim()||null,phone:String(b.client_phone||'').trim()||null,address:String(b.client_address||'').trim()||null,updated_at:new Date().toISOString()},{onConflict:'user_id,email,phone,name'}).select('id').single();
   customerId=c?.id||null;
 }
 const {data,error}=await supabase.from('quotes').update({customer_id:customerId,site_notes:String(b.site_notes||'').trim()||null,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',user.id).select('id,customer_id,site_notes').single();
 if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json(data);
}