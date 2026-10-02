import { createAdminClient } from '@/lib/supabase/admin';
import { sendPushToUser } from '@/lib/push';

type NotificationInput = {
  title: string;
  body: string;
  type?: string;
  link?: string;
  tag?: string;
  dedupeKey?: string;
};

export async function notifyUser(userId: string, input: NotificationInput) {
  const admin = createAdminClient();
  const { data, error } = await admin.from('notifications').insert({
    user_id: userId,
    title: input.title,
    body: input.body,
    type: input.type || 'account',
    link: input.link || null,
    dedupe_key: input.dedupeKey || null,
  }).select('id').single();

  if (error) {
    if (error.code === '23505' && input.dedupeKey) {
      const { data: existing } = await admin.from('notifications').select('id').eq('user_id', userId).eq('dedupe_key', input.dedupeKey).maybeSingle();
      return { notificationId: existing?.id || null, push: { sent: 0, skipped: true, duplicate: true }, error: null };
    }
    return { notificationId: null, push: { sent: 0, skipped: true }, error };
  }

  let push: any;
  try {
    push = await sendPushToUser(userId, {
      title: input.title,
      body: input.body,
      link: input.link,
      tag: input.tag || input.type || 'quvoto',
    });
  } catch (pushError) {
    push = { sent: 0, skipped: false, error: pushError instanceof Error ? pushError.message : 'Push delivery failed.' };
  }

  return { notificationId: data?.id || null, push, error: null };
}
