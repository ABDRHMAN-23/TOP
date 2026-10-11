import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runtimeEnv } from '@/lib/runtime-env';
import { parseMetaWhatsAppWebhook, verifyMetaWebhookChallenge, verifyMetaWebhookSignature } from '@/lib/aqarflow/whatsapp-cloud';
import { readBoundedUtf8Body } from '@/lib/aqarflow/whatsapp-http';
import { handleWhatsAppAutomaticReply, type AutoReplyIntegration } from '@/lib/aqarflow/automatic-sales-reply';
import { classifySalesMoment } from '@/lib/aqarflow/sales-playbook';

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
  const integrations=new Map<string,AutoReplyIntegration>();
  const disconnectedPhoneIds=new Set<string>();
  for(const phoneId of phoneIds){
    const {data,error}=await admin.from('aqarflow_whatsapp_integrations').select('id,owner_user_id,status,phone_number_id,graph_api_version,auto_reply_enabled,access_token_ciphertext,access_token_iv,token_expires_at').eq('phone_number_id',phoneId).maybeSingle();
    if(error||!data)return NextResponse.json({error:'Webhook tenant mapping is not ready.'},{status:503});
    if(data.status==='disconnected'){disconnectedPhoneIds.add(phoneId);continue;}
    if(data.status!=='active'&&data.status!=='needs_reauth')return NextResponse.json({error:'Webhook tenant mapping is not ready.'},{status:503});
    integrations.set(phoneId,{
      id:data.id,
      owner_user_id:data.owner_user_id,
      phone_number_id:data.phone_number_id,
      graph_api_version:data.graph_api_version,
      status:data.status,
      auto_reply_enabled:Boolean(data.auto_reply_enabled),
      access_token_ciphertext:typeof data.access_token_ciphertext==='string'?data.access_token_ciphertext:null,
      access_token_iv:typeof data.access_token_iv==='string'?data.access_token_iv:null,
      token_expires_at:typeof data.token_expires_at==='string'?data.token_expires_at:null,
    });
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
  // Atomically lease pending events before performing expensive generation or provider sends.
  // A duplicate Meta delivery cannot claim a fresh lease; stale leases can recover after a crash.
  const claimedEventKeys=new Set<string>();
  for(const [ownerUserId,rows] of grouped.entries()){
    const keys=[...new Set(rows.map(row=>row.provider_event_key).filter((key):key is string=>typeof key==='string'))];
    if(keys.length===0)continue;
    const claimAt=new Date().toISOString();
    const staleBefore=new Date(Date.now()-2*60*1000).toISOString();
    const {data:claimed,error:claimError}=await admin.from('aqarflow_whatsapp_events')
      .update({processing_status:'queued',processing_started_at:claimAt})
      .eq('owner_user_id',ownerUserId).in('provider_event_key',keys)
      .or(`processing_status.eq.received,processing_status.eq.failed,and(processing_status.eq.queued,processing_started_at.is.null),and(processing_status.eq.queued,processing_started_at.lt.${staleBefore})`)
      .select('provider_event_key');
    if(claimError)return NextResponse.json({error:'Could not claim pending webhook events safely.'},{status:503});
    for(const row of claimed||[]){
      if(typeof row.provider_event_key==='string')claimedEventKeys.add(ownerUserId+':'+row.provider_event_key);
    }
  }
  const acceptedKeysInBatch=new Set<string>();
  const acceptedEvents=processableEvents.filter(event=>{
    const integration=integrations.get(event.phoneNumberId);
    if(!integration)return false;
    const uniqueKey=integration.owner_user_id+':'+event.eventKey;
    if(!claimedEventKeys.has(uniqueKey)||acceptedKeysInBatch.has(uniqueKey))return false;
    acceptedKeysInBatch.add(uniqueKey);
    return true;
  });
  // Pre-scan the full webhook batch so a later opt-out or human request suppresses
  // replies to earlier messages from the same sender in this same provider delivery.
  const batchOptOutSenders=new Set<string>();
  const batchHandoffSenders=new Set<string>();
  for(const event of acceptedEvents){
    if(event.kind!=='inbound_message'||event.messageType!=='text'||!event.senderPhoneNumber)continue;
    const integration=integrations.get(event.phoneNumberId);
    if(!integration)continue;
    const senderKey=integration.owner_user_id+':'+event.senderPhoneNumber;
    const moment=classifySalesMoment(event.messageText||'');
    if(moment==='stop_contact')batchOptOutSenders.add(senderKey);
    if(moment==='human_handoff')batchHandoffSenders.add(senderKey);
  }
  if(acceptedEvents.length===0)return NextResponse.json({
    received:true,eventCount:0,duplicateEvents:processableEvents.length,
    ignoredDisconnected:events.length-processableEvents.length,
  },{status:200,headers:{'Cache-Control':'no-store'}});

  // Materialize only newly accepted events, keeping signed provider retries idempotent.
  for(const event of acceptedEvents){
    const integration=integrations.get(event.phoneNumberId)!;
    if(event.kind==='delivery_status'){
      // Recompute from the durable event ledger: callbacks may arrive before the CRM
      // row is created, and older delivery events may be retried after newer ones.
      const {data:latestStatuses,error:latestStatusError}=await admin.from('aqarflow_whatsapp_events')
        .select('provider_status,provider_timestamp,received_at')
        .eq('owner_user_id',integration.owner_user_id).eq('provider_message_id',event.messageId)
        .eq('event_kind','delivery_status')
        .order('provider_timestamp',{ascending:false,nullsFirst:false})
        .order('received_at',{ascending:false}).limit(1);
      if(latestStatusError)return NextResponse.json({error:'Could not load latest WhatsApp delivery status.'},{status:503});
      const latestStatus=latestStatuses?.[0]?.provider_status||event.status;
      const {error:outboundStatusError}=await admin.from('aqarflow_whatsapp_outbound_requests')
        .update({provider_status:latestStatus})
        .eq('owner_user_id',integration.owner_user_id).eq('integration_id',integration.id)
        .eq('provider_message_id',event.messageId);
      if(outboundStatusError)return NextResponse.json({error:'Could not persist WhatsApp outbound delivery status.'},{status:503});
      const {error:messageStatusError}=await admin.from('aqarflow_crm_messages')
        .update({provider_status:latestStatus})
        .eq('owner_user_id',integration.owner_user_id).eq('provider_message_id',event.messageId);
      if(messageStatusError)return NextResponse.json({error:'Could not persist WhatsApp CRM delivery status.'},{status:503});
      // A concurrent callback may have inserted a newer event while this request was
      // updating rows. Re-read after the write and repair if our view was stale.
      const {data:confirmedStatuses,error:confirmStatusError}=await admin.from('aqarflow_whatsapp_events')
        .select('provider_status,provider_timestamp,received_at')
        .eq('owner_user_id',integration.owner_user_id).eq('provider_message_id',event.messageId)
        .eq('event_kind','delivery_status')
        .order('provider_timestamp',{ascending:false,nullsFirst:false})
        .order('received_at',{ascending:false}).limit(1);
      if(confirmStatusError)return NextResponse.json({error:'Could not confirm latest WhatsApp delivery status.'},{status:503});
      const confirmedStatus=confirmedStatuses?.[0]?.provider_status;
      if(confirmedStatus&&confirmedStatus!==latestStatus){
        const {error:repairOutboundError}=await admin.from('aqarflow_whatsapp_outbound_requests')
          .update({provider_status:confirmedStatus})
          .eq('owner_user_id',integration.owner_user_id).eq('integration_id',integration.id)
          .eq('provider_message_id',event.messageId);
        if(repairOutboundError)return NextResponse.json({error:'Could not reconcile latest outbound delivery status.'},{status:503});
        const {error:repairMessageError}=await admin.from('aqarflow_crm_messages')
          .update({provider_status:confirmedStatus})
          .eq('owner_user_id',integration.owner_user_id).eq('provider_message_id',event.messageId);
        if(repairMessageError)return NextResponse.json({error:'Could not reconcile latest CRM delivery status.'},{status:503});
      }
      continue;
    }
    if(!event.senderPhoneNumber)continue;
    const now=new Date().toISOString();
    const eventAt=event.providerTimestamp||now;
    const {data:existingContact,error:existingContactError}=await admin.from('aqarflow_crm_contacts')
      .select('id,display_name,source,last_seen_at,ai_auto_reply_opted_out')
      .eq('owner_user_id',integration.owner_user_id).eq('phone_number',event.senderPhoneNumber).maybeSingle();
    if(existingContactError)return NextResponse.json({error:'Could not load WhatsApp contact.'},{status:503});
    const lastSeenAt=existingContact?.last_seen_at&&Date.parse(existingContact.last_seen_at)>Date.parse(eventAt)
      ?existingContact.last_seen_at:eventAt;
    const {data:contact,error:contactError}=await admin.from('aqarflow_crm_contacts').upsert({
      owner_user_id:integration.owner_user_id,phone_number:event.senderPhoneNumber,
      // Keep user-edited names and lead source; provider events should not overwrite CRM curation.
      display_name:existingContact?.display_name||event.senderDisplayName||null,source:existingContact?.source||'whatsapp',
      ai_auto_reply_opted_out:existingContact?.ai_auto_reply_opted_out??false,
      last_seen_at:lastSeenAt,updated_at:now,
    },{onConflict:'owner_user_id,phone_number'}).select('id,ai_auto_reply_opted_out').single();
    if(contactError||!contact)return NextResponse.json({error:'Could not persist WhatsApp contact.'},{status:503});
    const {data:existingConversation,error:existingConversationError}=await admin.from('aqarflow_crm_conversations')
      .select('id,status,last_message_at,last_message_preview,updated_at,handoff_required,buyer_profile')
      .eq('owner_user_id',integration.owner_user_id).eq('integration_id',integration.id).eq('contact_id',contact.id).maybeSingle();
    if(existingConversationError)return NextResponse.json({error:'Could not load CRM conversation.'},{status:503});
    const isLatest=!existingConversation||Date.parse(eventAt)>=Date.parse(existingConversation.last_message_at);
    const preview=event.messageText||(event.messageType?'['+event.messageType+']':'[WhatsApp message]');
    const {data:conversation,error:conversationError}=await admin.from('aqarflow_crm_conversations').upsert({
      owner_user_id:integration.owner_user_id,integration_id:integration.id,contact_id:contact.id,
      status:isLatest?'open':existingConversation.status,
      last_message_at:isLatest?eventAt:existingConversation.last_message_at,
      last_message_preview:isLatest?preview:existingConversation.last_message_preview,
      handoff_required:existingConversation?.handoff_required??false,
      buyer_profile:existingConversation?.buyer_profile??{},
      updated_at:isLatest?now:existingConversation.updated_at,
    },{onConflict:'owner_user_id,integration_id,contact_id'}).select('id').single();
    if(conversationError||!conversation)return NextResponse.json({error:'Could not persist CRM conversation.'},{status:503});
    const {error:messageError}=await admin.from('aqarflow_crm_messages').upsert({
      owner_user_id:integration.owner_user_id,conversation_id:conversation.id,direction:'inbound',channel:'whatsapp',
      message_type:event.messageType||'unknown',message_text:event.messageText,provider_message_id:event.messageId,
      provider_status:'received',created_at:event.providerTimestamp||now,
    },{onConflict:'owner_user_id,provider_message_id',ignoreDuplicates:true});
    if(messageError)return NextResponse.json({error:'Could not persist CRM message.'},{status:503});

    if(event.kind==='inbound_message') {
      const senderKey=integration.owner_user_id+':'+event.senderPhoneNumber;
      const currentMoment=classifySalesMoment(event.messageText||'');
      if(batchHandoffSenders.has(senderKey)&&currentMoment!=='human_handoff'&&currentMoment!=='stop_contact'){
        continue;
      }
      const replyResult=await handleWhatsAppAutomaticReply(admin,{
        integration,
        event,
        contactId:contact.id,
        conversationId:conversation.id,
        contactOptedOut:Boolean(contact.ai_auto_reply_opted_out)||batchOptOutSenders.has(senderKey),
        priorBuyerProfile:existingConversation?.buyer_profile??{},
      });
      if(replyResult.action==='failed') {
        await admin.from('aqarflow_whatsapp_events')
          .update({processing_status:'failed',processing_started_at:null})
          .eq('owner_user_id',integration.owner_user_id)
          .eq('provider_event_key',event.eventKey);
        return NextResponse.json({error:'Automatic reply processing did not finish safely; the event remains retryable.'},{status:503,headers:{'Cache-Control':'no-store'}});
      }
    }
  }
  for(const event of acceptedEvents){
    const integration=integrations.get(event.phoneNumberId);
    if(!integration)continue;
    const {error}=await admin.from('aqarflow_whatsapp_events')
      .update({processing_status:'processed',processing_started_at:null})
      .eq('owner_user_id',integration.owner_user_id)
      .eq('provider_event_key',event.eventKey);
    if(error)return NextResponse.json({error:'Could not finalize CRM event state.'},{status:503});
  }
  return NextResponse.json({received:true,eventCount:processableEvents.length,ignoredDisconnected:events.length-processableEvents.length},{status:200,headers:{'Cache-Control':'no-store'}});
}
