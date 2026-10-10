export type BoundedUtf8BodyResult = { ok: true; text: string } | { ok: false; code: 'too_large' | 'invalid_text' };

export async function readBoundedUtf8Body(req: Request, maxBytes: number): Promise<BoundedUtf8BodyResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || !req.body) return { ok: false, code: 'invalid_text' };
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, code: 'too_large' };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, code: 'invalid_text' };
  } finally {
    try { reader.releaseLock(); } catch {}
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) }; }
  catch { return { ok: false, code: 'invalid_text' }; }
}
