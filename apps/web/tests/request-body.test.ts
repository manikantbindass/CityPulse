// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { BodyLimitError, readBoundedBody } from '../lib/request-body';

function body(chunks: string[], length?: string) {
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      // Leave open so rejection must actively cancel the unread request.
    },
    cancel,
  });
  return {
    request: { body: stream, headers: new Headers(length ? { 'content-length': length } : {}) },
    cancel,
  };
}
describe('streaming request limit', () => {
  it('cancels chunked requests without trusting an absent or understated length', async () => {
    for (const length of [undefined, '1']) {
      const { request, cancel } = body(['abc', 'def', 'unread'], length);
      await expect(readBoundedBody(request, 5)).rejects.toBeInstanceOf(BodyLimitError);
      expect(cancel).toHaveBeenCalledOnce();
    }
  });
  it('counts UTF-8 bytes rather than JavaScript character length', async () => {
    const { request, cancel } = body(['₹₹']);
    await expect(readBoundedBody(request, 5)).rejects.toBeInstanceOf(BodyLimitError);
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('rejects declared oversized bodies before buffering', async () => {
    const { request, cancel } = body([], '1000000');
    await expect(readBoundedBody(request, 5)).rejects.toBeInstanceOf(BodyLimitError);
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('accepts the exact byte boundary including split UTF-8 sequences', async () => {
    const bytes = new TextEncoder().encode('₹a');
    const stream = new ReadableStream<Uint8Array<ArrayBuffer>>({
      start(c) {
        c.enqueue(bytes.slice(0, 1));
        c.enqueue(bytes.slice(1));
        c.close();
      },
    });
    expect(await readBoundedBody({ body: stream, headers: new Headers() }, 4)).toBe('₹a');
  });
});
