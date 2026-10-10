import assert from 'node:assert/strict';
import { buildMetaSignupExtras, parseMetaEmbeddedSignupMessage } from '../lib/aqarflow/whatsapp-signup.ts';

assert.deepEqual(
  parseMetaEmbeddedSignupMessage({
    type: 'WA_EMBEDDED_SIGNUP',
    event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
    data: { waba_id: '12345678901' },
  }),
  { wabaId: '12345678901' },
  'WABA-only finish events should be supported; the server can enumerate associated phone IDs',
);
assert.deepEqual(
  parseMetaEmbeddedSignupMessage(JSON.stringify({
    type: 'WA_EMBEDDED_SIGNUP',
    event: 'FINISH',
    data: { waba_id: '12345678901', phone_number_id: '10987654321' },
  })),
  { wabaId: '12345678901', phoneNumberId: '10987654321' },
);
assert.equal(parseMetaEmbeddedSignupMessage({type:'OTHER',event:'FINISH',data:{waba_id:'12345678901'}}), null);
assert.equal(parseMetaEmbeddedSignupMessage({type:'WA_EMBEDDED_SIGNUP',event:'CANCEL',data:{waba_id:'12345678901'}}), null);
assert.deepEqual(buildMetaSignupExtras('cloud_api'), {setup:{}});
assert.deepEqual(buildMetaSignupExtras('coexistence'), {
  setup:{},featureType:'whatsapp_business_app_onboarding',sessionInfoVersion:'3',
});
assert.equal(parseMetaEmbeddedSignupMessage({type:'WA_EMBEDDED_SIGNUP',data:{waba_id:'bad'}}), null);
assert.equal(parseMetaEmbeddedSignupMessage({type:'WA_EMBEDDED_SIGNUP',data:{waba_id:'12345678901',phone_number_id:'x'}}), null);
assert.equal(parseMetaEmbeddedSignupMessage('not-json'), null);
console.log('Meta Embedded Signup message parser tests passed.');
