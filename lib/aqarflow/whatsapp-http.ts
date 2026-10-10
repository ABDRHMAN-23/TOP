export type BoundedUtf8Body = { ok: true; text: string } | { ok: false; reason: 'too_large' | 'invalid_utf8' | 'missing_body' };

export async function readBoundedUtf8Body(request: Request, maximumBytes: number): Promise<BoundedUtf8Body> {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    try { await request.body?.cancel(); } catch {}
    return { ok: false, reason: 'too_large' };
  }
  const reader = request.body?.getReader();
  if (!reader) return { ok: false, reason: 'missing_body' };
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      totalBytes += item.value.byteLength;
      if (totalBytes > maximumBytes) {
        try { await reader.cancel(); } catch {}
        return { ok: false, reason: 'too_large' };
      }
      chunks.push(item.value);
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }
  const joined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  try { return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(joined) }; }
  catch { return { ok: false, reason: 'invalid_utf8' }; }
}

export async function readBoundedJson(
  request: Request,
  maximumBytes: number,
): Promise<{ ok: true; value: unknown } | { ok: false; reason: 'too_large' | 'invalid_utf8' | 'invalid_json' | 'missing_body' }> {
  const body = await readBoundedUtf8Body(request, maximumBytes);
  if (!body.ok) return body;
  try { return { ok: true, value: JSON.parse(body.text) as unknown }; }
  catch { return { ok: false, reason: 'invalid_json' }; }
}
