import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runtimeEnv } from '@/lib/runtime-env';
import { parseMetaWhatsAppWebhook, verifyMetaWebhookChallenge, verifyMetaWebhookSignature } from '@/lib/aqarflow/whatsapp-cloud';
import { readBoundedUtf8Body } from '@/lib/aqarflow/whatsapp-http';

export const dynamic='force-dynamic';
export async function GET(request:Request) {
  const url=new URL(request.url);const verifyToken=runtimeEnv('META_WEBHOOK_VERIFY_TOKEN');
  if(!verifyToken)return new Response('Webhook is not configured.',{status:503});
  if(!verifyMetaWebhookChallenge(url.searchParams.get('hub.mode'),url.searchParams.get('hub.verify_token'),verifyToken))return new Response('Forbidden.',{status:403});
  const challenge=url.searchParams.get('hub.challenge');if(!challenge||challenge.length>512)return new Response('Invalid challenge.',{status:400});
  return new Response(challenge,{status:200,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
}
export async function POST(request:Request) {
  const appSecret=runtimeEnv('META_APP_SECRET');
  if(!appSecret)return NextResponse.json({error:'Webhook is not configured.'},{status:503});
  const body=await readBoundedUtf8Body(request,524288);
  if(!body.ok)return NextResponse.json({error:body.reason==='too_large'?'Payload too large.':'Invalid payload.'},{status:body.reason==='too_large'?413:400});
  if(!(await verifyMetaWebhookSignature(body.text,request.headers.get('x-hub-signature-256'),appSecret))) {
    return NextResponse.json({error:'Invalid webhook signature.'},{status:401,headers:{'Cache-Control':'no-store'}});
  }
  let payload:unknown;try{payload=JSON.parse(body.text);}catch{return NextResponse.json({error:'Invalid JSON payload.'},{status:400});}
  const events=parseMetaWhatsAppWebhook(payload);
  if(!events.length)return NextResponse.json({received:true},{status:200,headers:{'Cache-Control':'no-store'}});
  let admin:ReturnType<typeof createAdminClient>;try{admin=createAdminClient();}catch{return NextResponse.json({error:'Webhook storage is unavailable.'},{status:503});}
  const phoneIds=Array.from(new Set(events.map(e=>e.phoneNumberId)));
  const integrations=new Map<string,{id:string;owner_user_id:string}>();
  const disconnectedPhoneIds=new Set<string>();
  for(const phoneId of phoneIds){
    const {data,error}=await admin.from('aqarflow_whatsapp_integrations').select('id,owner_user_id,status').eq('phone_number_id',phoneId).maybeSingle();
    if(error||!data)return NextResponse.json({error:'Webhook tenant mapping is not ready.'},{status:503});
    if(data.status==='disconnected'){disconnectedPhoneIds.add(phoneId);continue;}
    if(data.status!=='active'&&data.status!=='needs_reauth')return NextResponse.json({error:'Webhook tenant mapping is not ready.'},{status:503});
    integrations.set(phoneId,{id:data.id,owner_user_id:data.owner_user_id});
  }
  const processableEvents=events.filter(e=>!disconnectedPhoneIds.has(e.phoneNumberId));
  if(processableEvents.length===0)return NextResponse.json({received:true,ignoredDisconnected:events.length},{status:200,headers:{'Cache-Control':'no-store'}});
  const grouped=new Map<string,Record<string,unknown>[]>();
  for(const event of processableEvents){
    const integration=integrations.get(event.phoneNumberId);if(!integration)return NextResponse.json({error:'Webhook tenant mapping is missing.'},{status:503});
    const rows=grouped.get(integration.owner_user_id)||[];
    rows.push({owner_user_id:integration.owner_user_id,integration_id:integration.id,phone_number_id:event.phoneNumberId,
      provider_event_key:event.eventKey,event_kind:event.kind,provider_message_id:event.messageId,sender_phone_number:event.senderPhoneNumber,
      message_type:event.messageType,message_text:event.messageText,provider_status:event.status,provider_timestamp:event.providerTimestamp,
      processing_status:'received'});
    grouped.set(integration.owner_user_id,rows);
  }
  // Process only events inserted for the first time. Meta retries and duplicate
  // webhook entries must not reopen conversations or move their previews backwards.
  for(const rows of grouped.values()){
    const {error}=await admin.from('aqarflow_whatsapp_events')
      .upsert(rows,{onConflict:'owner_user_id,provider_event_key',ignoreDuplicates:true});
    if(error)return NextResponse.json({error:'Webhook event persistence failed.'},{status:503});
  }
  // Include both brand-new events and previous attempts that failed before finalization.
  // This allows a Meta retry to recover a partial DB failure while processed events remain idempotent.
  const pendingEventKeys=new Set<string>();
  for(const [ownerUserId,rows] of grouped.entries()){
    const keys=rows.map(row=>row.provider_event_key).filter((key):key is string=>typeof key==='string');
    if(keys.length===0)continue;
    const {data:pending,error}=await admin.from('aqarflow_whatsapp_events').select('provider_event_key')
      .eq('owner_user_id',ownerUserId).in('provider_event_key',keys).neq('processing_status','processed');
    if(error)return NextResponse.json({error:'Could not load pending webhook events.'},{status:503});
    for(const row of pending||[]){
      if(typeof row.provider_event_key==='string')pendingEventKeys.add(ownerUserId+':'+row.provider_event_key);
    }
  }
  const acceptedEvents=processableEvents.filter(event=>{
    const integration=integrations.get(event.phoneNumberId);
    return Boolean(integration&&pendingEventKeys.has(integration.owner_user_id+':'+event.eventKey));
  });
  if(acceptedEvents.length===0)return NextResponse.json({
    received:true,eventCount:0,duplicateEvents:processableEvents.length,
    ignoredDisconnected:events.length-processableEvents.length,
  },{status:200,headers:{'Cache-Control':'no-store'}});

  // Materialize only newly accepted events, keeping signed provider retries idempotent.
  for(const event of acceptedEvents){
    const integration=integrations.get(event.phoneNumberId)!;
    if(event.kind==='delivery_status'){
      const {error}=await admin.from('aqarflow_crm_messages')
        .update({provider_status:event.status})
        .eq('owner_user_id',integration.owner_user_id).eq('provider_message_id',event.messageId);
      if(error)return NextResponse.json({error:'Could not persist WhatsApp delivery status.'},{status:503});
      continue;
    }
    if(!event.senderPhoneNumber)continue;
    const now=new Date().toISOString();
    const eventAt=event.providerTimestamp||now;
    const {data:existingContact,error:existingContactError}=await admin.from('aqarflow_crm_contacts')
      .select('id,display_name,source,last_seen_at')
      .eq('owner_user_id',integration.owner_user_id).eq('phone_number',event.senderPhoneNumber).maybeSingle();
    if(existingContactError)return NextResponse.json({error:'Could not load WhatsApp contact.'},{status:503});
    const lastSeenAt=existingContact?.last_seen_at&&Date.parse(existingContact.last_seen_at)>Date.parse(eventAt)
      ?existingContact.last_seen_at:eventAt;
    const {data:contact,error:contactError}=await admin.from('aqarflow_crm_contacts').upsert({
      owner_user_id:integration.owner_user_id,phone_number:event.senderPhoneNumber,
      // Keep user-edited names and lead source; provider events should not overwrite CRM curation.
      display_name:existingContact?.display_name||event.senderDisplayName||null,source:existingContact?.source||'whatsapp',
      last_seen_at:lastSeenAt,updated_at:now,
    },{onConflict:'owner_user_id,phone_number'}).select('id').single();
    if(contactError||!contact)return NextResponse.json({error:'Could not persist WhatsApp contact.'},{status:503});
    const {data:existingConversation,error:existingConversationError}=await admin.from('aqarflow_crm_conversations')
      .select('id,status,last_message_at,last_message_preview,updated_at')
      .eq('owner_user_id',integration.owner_user_id).eq('integration_id',integration.id).eq('contact_id',contact.id).maybeSingle();
    if(existingConversationError)return NextResponse.json({error:'Could not load CRM conversation.'},{status:503});
    const isLatest=!existingConversation||Date.parse(eventAt)>=Date.parse(existingConversation.last_message_at);
    const preview=event.messageText||(event.messageType?'['+event.messageType+']':'[WhatsApp message]');
    const {data:conversation,error:conversationError}=await admin.from('aqarflow_crm_conversations').upsert({
      owner_user_id:integration.owner_user_id,integration_id:integration.id,contact_id:contact.id,
      status:isLatest?'open':existingConversation.status,
      last_message_at:isLatest?eventAt:existingConversation.last_message_at,
      last_message_preview:isLatest?preview:existingConversation.last_message_preview,
      updated_at:isLatest?now:existingConversation.updated_at,
    },{onConflict:'owner_user_id,integration_id,contact_id'}).select('id').single();
    if(conversationError||!conversation)return NextResponse.json({error:'Could not persist CRM conversation.'},{status:503});
    const {error:messageError}=await admin.from('aqarflow_crm_messages').upsert({
      owner_user_id:integration.owner_user_id,conversation_id:conversation.id,direction:'inbound',channel:'whatsapp',
      message_type:event.messageType||'unknown',message_text:event.messageText,provider_message_id:event.messageId,
      provider_status:'received',created_at:event.providerTimestamp||now,
    },{onConflict:'owner_user_id,provider_message_id',ignoreDuplicates:true});
    if(messageError)return NextResponse.json({error:'Could not persist CRM message.'},{status:503});
  }
  for(const event of acceptedEvents){
    const integration=integrations.get(event.phoneNumberId);
    if(!integration)continue;
    const {error}=await admin.from('aqarflow_whatsapp_events')
      .update({processing_status:'processed'})
      .eq('owner_user_id',integration.owner_user_id)
      .eq('provider_event_key',event.eventKey);
    if(error)return NextResponse.json({error:'Could not finalize CRM event state.'},{status:503});
  }
  return NextResponse.json({received:true,eventCount:processableEvents.length,ignoredDisconnected:events.length-processableEvents.length},{status:200,headers:{'Cache-Control':'no-store'}});
}
