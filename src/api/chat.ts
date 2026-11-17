import { request, type ChatRequest } from './client';
import { createSseParser } from './sse';

/** Mirrors ChatEvent in capsule-api/src/playground/playground.schemas.ts. */
export type ChatEvent =
  | { type: 'start'; provider: string; model: string; tools: string[]; systemPrompt: string }
  | { type: 'token'; text: string }
  | { type: 'tool_call'; id: string; name: string; args: unknown }
  | { type: 'tool_result'; id: string; name: string; ok: boolean; result: string; ms: number }
  | {
      type: 'done';
      ms: number;
      firstTokenMs: number | null;
      modelCalls: number;
      inputTokens: number | null;
      outputTokens: number | null;
    }
  | { type: 'error'; message: string };

const EVENT_TYPES = new Set(['start', 'token', 'tool_call', 'tool_result', 'done', 'error']);

export async function streamChat(
  body: ChatRequest,
  options: { token: string; signal: AbortSignal; onEvent: (event: ChatEvent) => void },
): Promise<void> {
  const res = await request('/v1/playground/chat', {
    method: 'POST',
    body: JSON.stringify(body),
    token: options.token,
    signal: options.signal,
  });
  if (!res.body) return;

  const parser = createSseParser(({ event, data }) => {
    if (!EVENT_TYPES.has(event)) return;
    try {
      options.onEvent({ type: event, ...(JSON.parse(data) as object) } as ChatEvent);
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
