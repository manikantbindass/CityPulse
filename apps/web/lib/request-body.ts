export class BodyLimitError extends Error {
  constructor() {
    super('Request exceeds the byte limit');
    this.name = 'BodyLimitError';
  }
}

/** Bound bytes before buffering, including chunked bodies without Content-Length. */
export async function readBoundedBody(
  request: Pick<Request, 'body' | 'headers'>,
  limit: number,
): Promise<string> {
  const declared = request.headers.get('content-length');
  if (declared && Number(declared) > limit) {
    await request.body?.cancel();
    throw new BodyLimitError();
  }
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new BodyLimitError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
