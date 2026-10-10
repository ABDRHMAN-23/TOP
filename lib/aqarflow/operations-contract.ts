export const AqarFlowTaskTypes = ['follow_up','call','send_information','viewing','document','other'] as const;
export const AqarFlowTaskPriorities = ['low','normal','high','urgent'] as const;
export const AqarFlowTaskStatuses = ['pending','in_progress','completed','cancelled'] as const;
export const AqarFlowViewingStatuses = ['scheduled','confirmed','completed','cancelled','no_show'] as const;

export type AqarFlowTaskType = typeof AqarFlowTaskTypes[number];
export type AqarFlowTaskPriority = typeof AqarFlowTaskPriorities[number];
export type AqarFlowTaskStatus = typeof AqarFlowTaskStatuses[number];
export type AqarFlowViewingStatus = typeof AqarFlowViewingStatuses[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}
export function cleanOperationText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(CONTROL_CHARS, '').trim().slice(0, max) : '';
}
function parseIso(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 64) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 80) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0); return true; }
  catch { return false; }
}
function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export type TaskCreateInput = {
  contactId: string;
  conversationId: string | null;
  taskType: AqarFlowTaskType;
  title: string;
  description: string | null;
  dueAt: string;
  priority: AqarFlowTaskPriority;
  assignedTo: string | null;
};
export type TaskPatchInput = {
  id: string;
  title?: string;
  description?: string | null;
  dueAt?: string;
  priority?: AqarFlowTaskPriority;
  status?: AqarFlowTaskStatus;
  resultNote?: string | null;
  assignedTo?: string | null;
};
export type ViewingCreateInput = {
  contactId: string;
  propertyId: string | null;
  title: string;
  location: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  notes: string | null;
};
export type ViewingPatchInput = {
  id: string;
  title?: string;
  location?: string | null;
  startsAt?: string;
  endsAt?: string;
  timezone?: string;
  notes?: string | null;
  status?: AqarFlowViewingStatus;
};
export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseTaskCreate(value: unknown): Parsed<TaskCreateInput> {
  if (!object(value)) return { ok: false, error: 'بيانات المهمة غير صحيحة.' };
  const contactId = value.contactId;
  const conversationId = value.conversationId === null || value.conversationId === undefined || value.conversationId === '' ? null : value.conversationId;
  const assignedTo = value.assignedTo === null || value.assignedTo === undefined || value.assignedTo === '' ? null : value.assignedTo;
  const title = cleanOperationText(value.title, 180);
  const taskType = value.taskType === undefined ? 'follow_up' : value.taskType;
  const priority = value.priority === undefined ? 'normal' : value.priority;
  const dueAt = parseIso(value.dueAt);
  const description = value.description === undefined || value.description === null || value.description === ''
    ? null : cleanOperationText(value.description, 2000);
  if (!isUuid(contactId) || (conversationId !== null && !isUuid(conversationId)) || (assignedTo !== null && !isUuid(assignedTo))) {
    return { ok: false, error: 'معرف العميل أو المحادثة أو المسؤول غير صحيح.' };
  }
  if (!title) return { ok: false, error: 'عنوان المهمة مطلوب.' };
  if (!AqarFlowTaskTypes.includes(taskType as AqarFlowTaskType)) return { ok: false, error: 'نوع المهمة غير مدعوم.' };
  if (!AqarFlowTaskPriorities.includes(priority as AqarFlowTaskPriority)) return { ok: false, error: 'أولوية المهمة غير صحيحة.' };
  if (!dueAt) return { ok: false, error: 'موعد المهمة غير صالح.' };
  if (value.description !== undefined && value.description !== null && typeof value.description !== 'string') {
    return { ok: false, error: 'وصف المهمة غير صالح.' };
  }
  if (typeof value.description === 'string' && value.description.length > 2000) return { ok: false, error: 'وصف المهمة يتجاوز الحد المسموح.' };
  return { ok: true, value: { contactId, conversationId, taskType: taskType as AqarFlowTaskType, title, description, dueAt,
    priority: priority as AqarFlowTaskPriority, assignedTo } };
}

export function parseTaskPatch(value: unknown): Parsed<TaskPatchInput> {
  if (!object(value) || !isUuid(value.id)) return { ok: false, error: 'معرف المهمة غير صحيح.' };
  const patch: TaskPatchInput = { id: value.id };
  let changes = 0;
  if (Object.hasOwn(value, 'title')) {
    const title = cleanOperationText(value.title, 180);
    if (!title) return { ok: false, error: 'عنوان المهمة مطلوب.' };
    patch.title = title; changes++;
  }
  if (Object.hasOwn(value, 'description')) {
    if (value.description !== null && typeof value.description !== 'string') return { ok: false, error: 'وصف المهمة غير صالح.' };
    if (typeof value.description === 'string' && value.description.length > 2000) return { ok: false, error: 'وصف المهمة يتجاوز الحد المسموح.' };
    patch.description = typeof value.description === 'string' ? cleanOperationText(value.description, 2000) || null : null; changes++;
  }
  if (Object.hasOwn(value, 'dueAt')) {
    const dueAt = parseIso(value.dueAt);
    if (!dueAt) return { ok: false, error: 'موعد المهمة غير صالح.' };
    patch.dueAt = dueAt; changes++;
  }
  if (Object.hasOwn(value, 'priority')) {
    if (!AqarFlowTaskPriorities.includes(value.priority as AqarFlowTaskPriority)) return { ok: false, error: 'أولوية المهمة غير صحيحة.' };
    patch.priority = value.priority as AqarFlowTaskPriority; changes++;
  }
  if (Object.hasOwn(value, 'status')) {
    if (!AqarFlowTaskStatuses.includes(value.status as AqarFlowTaskStatus)) return { ok: false, error: 'حالة المهمة غير صحيحة.' };
    patch.status = value.status as AqarFlowTaskStatus; changes++;
  }
  if (Object.hasOwn(value, 'resultNote')) {
    if (value.resultNote !== null && typeof value.resultNote !== 'string') return { ok: false, error: 'نتيجة المهمة غير صالحة.' };
    if (typeof value.resultNote === 'string' && value.resultNote.length > 1200) return { ok: false, error: 'نتيجة المهمة تتجاوز الحد المسموح.' };
    patch.resultNote = typeof value.resultNote === 'string' ? cleanOperationText(value.resultNote, 1200) || null : null; changes++;
  }
  if (Object.hasOwn(value, 'assignedTo')) {
    if (value.assignedTo !== null && value.assignedTo !== '' && !isUuid(value.assignedTo)) return { ok: false, error: 'المسؤول المحدد غير صحيح.' };
    patch.assignedTo = isUuid(value.assignedTo) ? value.assignedTo : null; changes++;
  }
  if (!changes) return { ok: false, error: 'لا توجد تغييرات لحفظها.' };
  return { ok: true, value: patch };
}

export function parseViewingCreate(value: unknown, nowMs = Date.now()): Parsed<ViewingCreateInput> {
  if (!object(value)) return { ok: false, error: 'بيانات المعاينة غير صحيحة.' };
  const contactId = value.contactId;
  const propertyId = value.propertyId === null || value.propertyId === undefined || value.propertyId === '' ? null : value.propertyId;
  const title = cleanOperationText(value.title, 180);
  const location = value.location === null || value.location === undefined || value.location === '' ? null : cleanOperationText(value.location, 240);
  const notes = value.notes === null || value.notes === undefined || value.notes === '' ? null : cleanOperationText(value.notes, 2000);
  const startsAt = parseIso(value.startsAt);
  const endsAt = parseIso(value.endsAt);
  const timezone = value.timezone === undefined ? 'Asia/Aden' : value.timezone;
  if (!isUuid(contactId) || (propertyId !== null && !isUuid(propertyId))) return { ok: false, error: 'معرف العميل أو العقار غير صحيح.' };
  if (!title) return { ok: false, error: 'عنوان المعاينة مطلوب.' };
  if (!startsAt || !endsAt) return { ok: false, error: 'وقت بداية المعاينة ونهايتها مطلوبان.' };
  const start = Date.parse(startsAt), end = Date.parse(endsAt);
  if (start < nowMs - 5 * 60_000) return { ok: false, error: 'لا يمكن جدولة معاينة في وقت مضى.' };
  if (end <= start) return { ok: false, error: 'يجب أن تكون نهاية المعاينة بعد بدايتها.' };
  if (end - start > 12 * 60 * 60_000) return { ok: false, error: 'مدة المعاينة لا يمكن أن تتجاوز 12 ساعة.' };
  if (!isTimeZone(timezone)) return { ok: false, error: 'المنطقة الزمنية غير صالحة.' };
  if (value.location !== undefined && value.location !== null && typeof value.location !== 'string') return { ok: false, error: 'موقع المعاينة غير صالح.' };
  if (typeof value.location === 'string' && value.location.length > 240) return { ok: false, error: 'موقع المعاينة يتجاوز الحد المسموح.' };
  if (value.notes !== undefined && value.notes !== null && typeof value.notes !== 'string') return { ok: false, error: 'ملاحظات المعاينة غير صالحة.' };
  if (typeof value.notes === 'string' && value.notes.length > 2000) return { ok: false, error: 'ملاحظات المعاينة تتجاوز الحد المسموح.' };
  return { ok: true, value: { contactId, propertyId, title, location, startsAt, endsAt, timezone: timezone as string, notes } };
}

export function parseViewingPatch(value: unknown, nowMs = Date.now()): Parsed<ViewingPatchInput> {
  if (!object(value) || !isUuid(value.id)) return { ok: false, error: 'معرف المعاينة غير صحيح.' };
  const patch: ViewingPatchInput = { id: value.id };
  let changes = 0;
  if (Object.hasOwn(value, 'title')) {
    const title = cleanOperationText(value.title, 180);
    if (!title) return { ok: false, error: 'عنوان المعاينة مطلوب.' };
    patch.title = title; changes++;
  }
  if (Object.hasOwn(value, 'location')) {
    if (value.location !== null && typeof value.location !== 'string') return { ok: false, error: 'موقع المعاينة غير صالح.' };
    if (typeof value.location === 'string' && value.location.length > 240) return { ok: false, error: 'موقع المعاينة يتجاوز الحد المسموح.' };
    patch.location = typeof value.location === 'string' ? cleanOperationText(value.location, 240) || null : null; changes++;
  }
  if (Object.hasOwn(value, 'notes')) {
    if (value.notes !== null && typeof value.notes !== 'string') return { ok: false, error: 'ملاحظات المعاينة غير صالحة.' };
    if (typeof value.notes === 'string' && value.notes.length > 2000) return { ok: false, error: 'ملاحظات المعاينة تتجاوز الحد المسموح.' };
    patch.notes = typeof value.notes === 'string' ? cleanOperationText(value.notes, 2000) || null : null; changes++;
  }
  if (Object.hasOwn(value, 'timezone')) {
    if (!isTimeZone(value.timezone)) return { ok: false, error: 'المنطقة الزمنية غير صالحة.' };
    patch.timezone = value.timezone; changes++;
  }
  const hasStart = Object.hasOwn(value, 'startsAt'), hasEnd = Object.hasOwn(value, 'endsAt');
  if (hasStart !== hasEnd) return { ok: false, error: 'يجب إرسال بداية المعاينة ونهايتها معًا.' };
  if (hasStart && hasEnd) {
    const startsAt = parseIso(value.startsAt), endsAt = parseIso(value.endsAt);
    if (!startsAt || !endsAt) return { ok: false, error: 'وقت المعاينة غير صالح.' };
    if (Date.parse(startsAt) < nowMs - 5 * 60_000 || Date.parse(endsAt) <= Date.parse(startsAt)
      || Date.parse(endsAt) - Date.parse(startsAt) > 12 * 60 * 60_000) {
      return { ok: false, error: 'تحقق من بداية المعاينة ونهايتها ومدتها.' };
    }
    patch.startsAt = startsAt; patch.endsAt = endsAt; changes++;
  }
  if (Object.hasOwn(value, 'status')) {
    if (!AqarFlowViewingStatuses.includes(value.status as AqarFlowViewingStatus)) return { ok: false, error: 'حالة المعاينة غير صحيحة.' };
    patch.status = value.status as AqarFlowViewingStatus; changes++;
  }
  if (!changes) return { ok: false, error: 'لا توجد تغييرات لحفظها.' };
  return { ok: true, value: patch };
}

export function isTransitionAllowed(current: string, next: string, kind: 'task' | 'viewing'): boolean {
  if (current === 'cancelled') return next === 'cancelled';
  if (kind === 'task') return AqarFlowTaskStatuses.includes(next as AqarFlowTaskStatus);
  return AqarFlowViewingStatuses.includes(next as AqarFlowViewingStatus);
}
