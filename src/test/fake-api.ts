import { vi } from 'vitest';
import type { ChatEvent } from '../api/chat';

export const tokens = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  tokenType: 'Bearer' as const,
  expiresIn: 900,
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** An SSE response delivered in deliberately awkward chunks, like a real network. */
export function sse(events: ChatEvent[], chunkSize = 17): Response {
  const text = events
    .map(({ type, ...data }) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)
    .join('');
  const bytes = new TextEncoder().encode(text);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunkSize) controller.enqueue(bytes.slice(i, i + chunkSize));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

export interface Call {
  path: string;
  method: string;
  body: unknown;
  authorization: string | null;
}

/** Replaces fetch with a router keyed by "METHOD /path". Returns the calls it received. */
export function mockApi(routes: Record<string, (call: Call) => Response | Promise<Response>>) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      const method = init?.method ?? 'GET';
      const headers = new Headers(init?.headers);
      const call: Call = {
        path,
        method,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
        authorization: headers.get('Authorization'),
      };
      calls.push(call);
      const route = routes[`${method} ${path}`];
      if (!route) return json({ message: `No route for ${method} ${path}` }, 404);
      return route(call);
    }),
  );
  return calls;
}
