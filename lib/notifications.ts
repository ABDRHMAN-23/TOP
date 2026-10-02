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

  if (error) return { notificationId: null, push: { sent: 0, skipped: true }, error };

  const push = await sendPushToUser(userId, {
    title: input.title,
    body: input.body,
    link: input.link,
    tag: input.tag || input.type || 'quvoto',
  });

  return { notificationId: data?.id || null, push, error: null };
}
