import { describe, expect, it } from 'vitest';
import { readResponseTextLimited } from './response-body.util';

function streamFromChunks(chunks: Array<string | Uint8Array>) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(
          typeof chunk === 'string' ? encoder.encode(chunk) : chunk,
        );
      }
      controller.close();
    },
  });
}

describe('readResponseTextLimited', () => {
  it('returns full body when under limit', async () => {
    const response = new Response(streamFromChunks(['hello', ' ', 'world']));
    const result = await readResponseTextLimited(response, 1024);
    expect(result).toEqual({
      text: 'hello world',
      truncated: false,
      bytesRead: 11,
    });
  });

  it('truncates when over limit', async () => {
    const response = new Response(streamFromChunks(['abcdef']));
    const result = await readResponseTextLimited(response, 3);
    expect(result.text).toBe('abc');
    expect(result.truncated).toBe(true);
    expect(result.bytesRead).toBe(3);
  });
});

