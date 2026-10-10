import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runtimeEnv } from '@/lib/runtime-env';
import { decryptMetaAccessToken, normalizeWhatsAppPhone, sendMetaWhatsAppText, sha256Hex, WhatsAppCloudApiError } from '@/lib/aqarflow/whatsapp-cloud';
import { readBoundedJson } from '@/lib/aqarflow/whatsapp-http';
import { requireOwnerAccount } from '@/lib/aqarflow/whatsapp-owner';

export const dynamic='force-dynamic';
const CUSTOMER_SERVICE_WINDOW_MS=24*60*60*1000;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isRecord(v:unknown):v is Record<string,unknown>{return Boolean(v)&&typeof v==='object'&&!Array.isArray(v);}
function response(body:unknown,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});}

async function persistCrmOutbound(admin:ReturnType<typeof createAdminClient>,ownerId:string,conversationId:string|null,message:string,messageId:string){
  if(!conversationId)return true;
  const now=new Date().toISOString();
  const {data:conversation,error:conversationError}=await admin.from('aqarflow_crm_conversations')
    .select('id,contact_id,integration_id').eq('owner_user_id',ownerId).eq('id',conversationId).maybeSingle();
  if(conversationError||!conversation)return false;
  const {error:messageError}=await admin.from('aqarflow_crm_messages').upsert({
    owner_user_id:ownerId,conversation_id:conversationId,direction:'outbound',channel:'whatsapp',message_type:'text',
    message_text:message,provider_message_id:messageId,provider_status:'sent',created_at:now,sent_at:now,
  },{onConflict:'owner_user_id,provider_message_id',ignoreDuplicates:true});
  if(messageError)return false;
  await admin.from('aqarflow_crm_conversations').update({last_message_at:now,last_message_preview:message.slice(0,500),updated_at:now})
    .eq('owner_user_id',ownerId).eq('id',conversationId);
  return true;
}

export async function POST(request:Request){
  const owner=await requireOwnerAccount();
  if(!owner.ok)return response({error:owner.message},owner.status);
  const body=await readBoundedJson(request,12000);
  if(!body.ok)return response({error:body.reason==='too_large'?'Request too large.':'Invalid request body.'},body.reason==='too_large'?413:400);
  if(!isRecord(body.value))return response({error:'Invalid request body.'},400);
  const phoneNumberId=typeof body.value.phoneNumberId==='string'?body.value.phoneNumberId:'';
  const to=normalizeWhatsAppPhone(body.value.to);
  const message=typeof body.value.text==='string'?body.value.text.replace(/[\u0000-\u0008\u000B\u000C-\u001F\u007F]/g,'').trim():'';
  const idempotencyKey=typeof body.value.idempotencyKey==='string'?body.value.idempotencyKey.trim():'';
  const conversationId=typeof body.value.conversationId==='string'?body.value.conversationId:null;
  if(!/^\d{5,40}$/.test(phoneNumberId)||!to||!message||message.length>4096||!/^[A-Za-z0-9_-]{8,96}$/.test(idempotencyKey)||(conversationId&&!UUID.test(conversationId))){
    return response({error:'Valid phone number, recipient, message, idempotency key, and optional conversation ID are required.'},400);
  }
  const encryptionKey=runtimeEnv('META_TOKEN_ENCRYPTION_KEY');
  if(!encryptionKey)return response({error:'WhatsApp token encryption is not configured.'},503);
  let admin:ReturnType<typeof createAdminClient>;try{admin=createAdminClient();}catch{return response({error:'Secure WhatsApp storage is unavailable.'},503);}
  const {data:integration,error:integrationError}=await admin.from('aqarflow_whatsapp_integrations')
    .select('id,phone_number_id,graph_api_version,access_token_ciphertext,access_token_iv,token_expires_at,status')
    .eq('owner_user_id',owner.ownerUserId).eq('phone_number_id',phoneNumberId).maybeSingle();
  if(integrationError||!integration)return response({error:'WhatsApp number is not connected to this workspace.'},404);
  if(integration.status!=='active')return response({error:'WhatsApp connection needs attention before sending.'},409);
  if(integration.token_expires_at&&Date.parse(integration.token_expires_at)<=Date.now()+60000){
    await admin.from('aqarflow_whatsapp_integrations').update({status:'needs_reauth',updated_at:new Date().toISOString()}).eq('id',integration.id);
    return response({error:'WhatsApp authorization has expired; reconnect the number.'},409);
  }
  if(conversationId){
    const {data:conversation,error}=await admin.from('aqarflow_crm_conversations').select('id,contact_id,integration_id')
      .eq('owner_user_id',owner.ownerUserId).eq('id',conversationId).maybeSingle();
    if(error)return response({error:'Could not verify the conversation.'},503);
    if(!conversation||conversation.integration_id!==integration.id)return response({error:'Conversation does not belong to this WhatsApp number.'},404);
    const {data:contact,error:contactError}=await admin.from('aqarflow_crm_contacts').select('phone_number')
      .eq('owner_user_id',owner.ownerUserId).eq('id',conversation.contact_id).maybeSingle();
    if(contactError)return response({error:'Could not verify the conversation contact.'},503);
    if(!contact||contact.phone_number!==to)return response({error:'The recipient does not match the selected CRM conversation.'},409);
  }
  const {data:lastInbound,error:inboundError}=await admin.from('aqarflow_whatsapp_events').select('provider_timestamp')
    .eq('owner_user_id',owner.ownerUserId).eq('phone_number_id',phoneNumberId).eq('event_kind','inbound_message')
    .eq('sender_phone_number',to).not('provider_timestamp','is',null).order('provider_timestamp',{ascending:false}).limit(1).maybeSingle();
  if(inboundError)return response({error:'Could not verify the customer-service window.'},503);
  const inboundAt=lastInbound?.provider_timestamp?Date.parse(lastInbound.provider_timestamp):NaN;
  if(!Number.isFinite(inboundAt)||Date.now()-inboundAt<0||Date.now()-inboundAt>=CUSTOMER_SERVICE_WINDOW_MS){
    return response({error:'Free-form replies are allowed only within 24 hours of the customer’s latest message. Approved template messaging is not implemented.'},409);
  }
  const requestHash=await sha256Hex(phoneNumberId+'\n'+to+'\n'+message+'\n'+(conversationId||''));
  const {data:existing,error:existingError}=await admin.from('aqarflow_whatsapp_outbound_requests')
    .select('request_hash,status,provider_message_id').eq('owner_user_id',owner.ownerUserId).eq('idempotency_key',idempotencyKey).maybeSingle();
  if(existingError)return response({error:'Could not check outbound idempotency record.'},503);
  if(existing){
    if(existing.request_hash!==requestHash)return response({error:'This idempotency key was already used for a different message.'},409);
    if(existing.status==='sent'&&existing.provider_message_id){
      const persisted=await persistCrmOutbound(admin,owner.ownerUserId,conversationId,message,existing.provider_message_id);
      return response({sent:true,persisted,messageId:existing.provider_message_id,replayed:true});
    }
    return response({error:'This message key was already claimed and will not be resent automatically. Check delivery status before using a new key.',idempotencyKey},409);
  }
  const {error:claimError}=await admin.from('aqarflow_whatsapp_outbound_requests').insert({
    owner_user_id:owner.ownerUserId,integration_id:integration.id,idempotency_key:idempotencyKey,request_hash:requestHash,
    phone_number_id:phoneNumberId,recipient_phone_number:to,status:'pending',
  });
  if(claimError)return response({error:'Could not safely claim this message key. Retry with the same key after checking status.',idempotencyKey},409);
  let accessToken:string;
  try{accessToken=await decryptMetaAccessToken(integration.access_token_ciphertext,integration.access_token_iv,encryptionKey);}
  catch{
    await admin.from('aqarflow_whatsapp_outbound_requests').update({status:'failed',failure_code:'token_decryption_failed'}).eq('owner_user_id',owner.ownerUserId).eq('idempotency_key',idempotencyKey);
    return response({error:'WhatsApp credentials could not be decrypted; reconnect after checking server key configuration.'},503);
  }
  try{
    const sent=await sendMetaWhatsAppText({graphApiVersion:integration.graph_api_version,phoneNumberId,accessToken,to,text:message});
    const {error:updateError}=await admin.from('aqarflow_whatsapp_outbound_requests').update({status:'sent',provider_message_id:sent.messageId,sent_at:new Date().toISOString()})
      .eq('owner_user_id',owner.ownerUserId).eq('idempotency_key',idempotencyKey);
    if(updateError)return response({sent:true,persisted:false,messageId:sent.messageId,idempotencyKey},202);
    const persisted=await persistCrmOutbound(admin,owner.ownerUserId,conversationId,message,sent.messageId);
    return response({sent:true,persisted,messageId:sent.messageId,replayed:false},persisted?200:202);
  }catch(error){
    const knownRejection=error instanceof WhatsAppCloudApiError&&error.httpStatus>=400&&error.httpStatus<500;
    await admin.from('aqarflow_whatsapp_outbound_requests').update({status:knownRejection?'failed':'unknown',failure_code:error instanceof WhatsAppCloudApiError?error.code:'provider_error'})
      .eq('owner_user_id',owner.ownerUserId).eq('idempotency_key',idempotencyKey);
    return response({error:'Meta did not confirm the message. The key will not be retried automatically to avoid duplicate sends.',idempotencyKey},502);
  }
}
