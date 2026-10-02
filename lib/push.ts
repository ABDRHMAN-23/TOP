import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';

type PushPayload={title:string;body:string;link?:string;tag?:string};

export async function sendPushToUser(userId:string,payload:PushPayload){
  const publicKey=process.env.VAPID_PUBLIC_KEY;
  const privateKey=process.env.VAPID_PRIVATE_KEY;
  const subject=process.env.VAPID_SUBJECT||'mailto:notifications@quvoto.com';
  if(!publicKey||!privateKey)return {sent:0,skipped:true};
  webpush.setVapidDetails(subject,publicKey,privateKey);
  const supabase=createAdminClient();
  const {data:subs}=await supabase.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id',userId);
  let sent=0;
  for(const sub of subs||[]){
    try{
      await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify(payload));
      sent++;
      await supabase.from('push_subscriptions').update({last_seen_at:new Date().toISOString()}).eq('id',sub.id);
    }catch(error:any){
      if(error?.statusCode===404||error?.statusCode===410)await supabase.from('push_subscriptions').delete().eq('id',sub.id);
    }
  }
  return {sent,skipped:false};
}
