import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function POST(req:Request){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:'Authentication required'},{status:401});
 const form=await req.formData(); const quoteId=String(form.get('quote_id')||''); const file=form.get('file');
 if(!quoteId||!(file instanceof File))return NextResponse.json({error:'Quote and photo are required.'},{status:400});
 if(file.size>8*1024*1024)return NextResponse.json({error:'Each photo must be 8 MB or smaller.'},{status:400});
 if(!file.type.startsWith('image/'))return NextResponse.json({error:'Only image files are supported.'},{status:400});
 const {data:q}=await supabase.from('quotes').select('id').eq('id',quoteId).eq('user_id',user.id).single(); if(!q)return NextResponse.json({error:'Quote not found.'},{status:404});
 const path=user.id+'/'+quoteId+'/'+crypto.randomUUID()+'.'+(file.type.split('/')[1]||'jpg');
 const {error:uploadError}=await supabase.storage.from('quote-photos').upload(path,file,{contentType:file.type,upsert:false});
 if(uploadError)return NextResponse.json({error:uploadError.message},{status:400});
 const {data:urlData}=supabase.storage.from('quote-photos').getPublicUrl(path);
 const {data,error}=await supabase.from('quote_photos').insert({user_id:user.id,quote_id:quoteId,storage_path:path,url:urlData.publicUrl}).select().single();
 if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json(data);
}