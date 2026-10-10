import assert from 'node:assert/strict';
import {
  isUuid, parseTaskCreate, parseTaskPatch, parseViewingCreate, parseViewingPatch, isTransitionAllowed,
} from '../lib/aqarflow/operations-contract.ts';

const ownerId='00000000-0000-4000-8000-000000000001';
const contactId='10000000-0000-4000-8000-000000000001';
const propertyId='20000000-0000-4000-8000-000000000001';
const taskId='30000000-0000-4000-8000-000000000001';
const viewingId='40000000-0000-4000-8000-000000000001';
const baseNow=Date.parse('2027-01-01T00:00:00.000Z');
const future='2027-01-02T10:00:00.000Z';

assert.equal(isUuid(ownerId),true);
assert.equal(isUuid('not-a-uuid'),false);

const task=parseTaskCreate({contactId,title:'  اتصل بالعميل  ',dueAt:future,priority:'high',taskType:'call',description:'\u0001اتصال'});
assert.equal(task.ok,true);
if(task.ok){
  assert.equal(task.value.title,'اتصل بالعميل');
  assert.equal(task.value.taskType,'call');
  assert.equal(task.value.priority,'high');
  assert.equal(task.value.description,'اتصال');
}
assert.equal(parseTaskCreate({contactId:'x',title:'مهمة',dueAt:future}).ok,false);
assert.equal(parseTaskCreate({contactId,title:'',dueAt:future}).ok,false);
assert.equal(parseTaskCreate({contactId,title:'مهمة',dueAt:'invalid'}).ok,false);
assert.equal(parseTaskCreate({contactId,title:'مهمة',dueAt:future,priority:'godmode'}).ok,false);
assert.equal(parseTaskPatch({id:taskId}).ok,false);
assert.equal(parseTaskPatch({id:taskId,status:'completed'}).ok,true);
assert.equal(parseTaskPatch({id:taskId,resultNote:'x'.repeat(1201)}).ok,false);

const viewing=parseViewingCreate({
  contactId,propertyId,title:'معاينة الشقة',startsAt:future,
  endsAt:'2027-01-02T11:00:00.000Z',timezone:'Asia/Aden',location:'المنصورة',notes:'مع العميل',
},baseNow);
assert.equal(viewing.ok,true);
if(viewing.ok){
  assert.equal(viewing.value.timezone,'Asia/Aden');
  assert.equal(viewing.value.propertyId,propertyId);
}
assert.equal(parseViewingCreate({
  contactId,title:'معاينة',startsAt:'2026-12-31T10:00:00Z',endsAt:'2026-12-31T11:00:00Z',
},baseNow).ok,false,'past viewings must be rejected');
assert.equal(parseViewingCreate({
  contactId,title:'معاينة',startsAt:future,endsAt:future,timezone:'Asia/Aden',
},baseNow).ok,false,'end must be after start');
assert.equal(parseViewingCreate({
  contactId,title:'معاينة',startsAt:future,endsAt:'2027-01-03T00:00:00Z',timezone:'Asia/Aden',
},baseNow).ok,false,'duration is capped at 12 hours');
assert.equal(parseViewingCreate({
  contactId,title:'معاينة',startsAt:future,endsAt:'2027-01-02T11:00:00Z',timezone:'Not/AZone',
},baseNow).ok,false,'unknown time zones must be rejected');
assert.equal(parseViewingPatch({id:viewingId,startsAt:future}).ok,false,'start/end must be patched together');
assert.equal(parseViewingPatch({id:viewingId,status:'confirmed'}).ok,true);
assert.equal(parseViewingPatch({id:'invalid',status:'confirmed'}).ok,false);

assert.equal(isTransitionAllowed('pending','completed','task'),true);
assert.equal(isTransitionAllowed('cancelled','pending','task'),false);
assert.equal(isTransitionAllowed('cancelled','cancelled','viewing'),true);
console.log('AqarFlow operations validation tests passed.');
