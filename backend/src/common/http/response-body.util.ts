export type ReadResponseTextLimitedResult = {
  text: string;
  truncated: boolean;
  bytesRead: number;
};

export async function readResponseTextLimited(
  response: Response,
  maxBytes: number,
): Promise<ReadResponseTextLimitedResult> {
  const body = response.body;
  if (!body) {
    return { text: '', truncated: false, bytesRead: 0 };
  }

  const limit = Number.isFinite(maxBytes) ? Math.max(0, Math.floor(maxBytes)) : 0;
  if (limit === 0) {
    await body.cancel();
    return { text: '', truncated: true, bytesRead: 0 };
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let truncated = false;
  let text = '';

  try {
    // Read incrementally so we can stop early on huge/abusive responses.
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.length === 0) continue;

      if (bytesRead + value.byteLength > limit) {
        const remaining = Math.max(0, limit - bytesRead);
        if (remaining > 0) {
          text += decoder.decode(value.subarray(0, remaining), { stream: true });
          bytesRead += remaining;
        }
        truncated = true;
        await reader.cancel();
        break;
      }

      bytesRead += value.byteLength;
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    text += decoder.decode();
  }

  return { text, truncated, bytesRead };
}
