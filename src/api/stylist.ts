import { request } from './client';
import type { paths } from './schema';
import { createSseParser } from './sse';

export type StylistRequest = paths['/v1/stylist/chat']['post']['requestBody']['content']['application/json'];

/** Mirrors StylistEvent in capsule-api/src/stylist/stylist.schemas.ts. SSE events are not in openapi.json. */
export type StylistEvent =
  | { type: 'step'; step: string }
  | {
      type: 'outfit';
      id: string | null;
      occasion: string | null;
      items: { id: string; name: string }[];
      removed: { name: string; reason: string }[];
      missing: string | null;
    }
  | { type: 'token'; text: string }
  | { type: 'done'; ms: number; firstTokenMs: number | null; consulted: string[] }
  | { type: 'error'; message: string };

const EVENT_TYPES = new Set(['step', 'outfit', 'token', 'done', 'error']);

export async function streamStylist(
  body: StylistRequest,
  options: { token: string; signal: AbortSignal; onEvent: (event: StylistEvent) => void },
): Promise<void> {
  const res = await request('/v1/stylist/chat', {
    method: 'POST',
    body: JSON.stringify(body),
    token: options.token,
    signal: options.signal,
  });
  if (!res.body) return;

  const parser = createSseParser(({ event, data }) => {
    if (!EVENT_TYPES.has(event)) return;
    try {
      options.onEvent({ type: event, ...(JSON.parse(data) as object) } as StylistEvent);
    } catch {
      // A malformed event is skipped; the stream carries on.
    }
  });

  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.push(value);
  }
  parser.end();
}
