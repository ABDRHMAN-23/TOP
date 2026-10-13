import { transitionRecording } from '@/lib/recordings/transition';

export async function POST(request: Request, ctx: { params: Promise<{ recordingId: string }> }) {
  return transitionRecording(request, ctx, 'capturing');
}
