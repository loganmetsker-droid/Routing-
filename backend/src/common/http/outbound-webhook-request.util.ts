type FetchInit = NonNullable<Parameters<typeof fetch>[1]>;

export type OutboundWebhookRequestMeta = {
  eventType: string;
  signature: string;
  timestamp: string;
  requestId: string;
};

export function createOutboundWebhookFetchInit(
  meta: OutboundWebhookRequestMeta,
  body: string,
  signal?: AbortSignal,
): FetchInit {
  return {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'trovan-webhooks/1.0',
      'x-trovan-event': meta.eventType,
      'x-trovan-signature': meta.signature,
      'x-trovan-timestamp': meta.timestamp,
      'x-request-id': meta.requestId,
    },
    body,
    signal,
  };
}
