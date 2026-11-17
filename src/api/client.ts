import type { paths } from './schema';

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

type Json<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  responses: infer R;
}
  ? R extends Record<number, unknown>
    ? {
        [S in keyof R]: R[S] extends { content: { 'application/json': infer B } } ? B : never;
      }[keyof R]
    : never
  : never;

export type Tokens = Json<'/v1/auth/login', 'post'>;
export type Me = Json<'/v1/auth/me', 'get'>;
export type ModelsStatus = Json<'/v1/models', 'get'>;
export type Credentials = paths['/v1/auth/login']['post']['requestBody']['content']['application/json'];
export type ChatRequest = paths['/v1/playground/chat']['post']['requestBody']['content']['application/json'];
export type WardrobeList = Json<'/v1/wardrobe/items', 'get'>;
export type WardrobeItem = WardrobeList['items'][number];

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** status 0 means the request never reached the API. */
export const isNetworkError = (e: unknown) => e instanceof ApiError && e.status === 0;

async function readError(res: Response): Promise<ApiError> {
  let message = res.statusText;
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) message = body.message.join(' ');
    else if (body.message) message = body.message;
  } catch {
    // Not JSON; keep the status text.
  }
  return new ApiError(res.status, message);
}

export async function request(path: string, init: RequestInit & { token?: string } = {}): Promise<Response> {
  const { token, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'network');
  }
  if (!res.ok) throw await readError(res);
  return res;
}

const post = (path: string, body: unknown, token?: string) =>
  request(path, { method: 'POST', body: JSON.stringify(body), token });

export const api = {
  register: async (c: Credentials) => (await (await post('/v1/auth/register', c)).json()) as Tokens,
  login: async (c: Credentials) => (await (await post('/v1/auth/login', c)).json()) as Tokens,
  refresh: async (refreshToken: string) =>
    (await (await post('/v1/auth/refresh', { refreshToken })).json()) as Tokens,
  logout: async (refreshToken: string) => {
    await post('/v1/auth/logout', { refreshToken });
  },
  me: async (token: string) => (await (await request('/v1/auth/me', { token })).json()) as Me,
  models: async (token: string) => (await (await request('/v1/models', { token })).json()) as ModelsStatus,
  wardrobe: async (token: string) =>
    (await (await request('/v1/wardrobe/items', { token })).json()) as WardrobeList,
};
