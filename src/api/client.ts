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
export type NewItem = paths['/v1/wardrobe/items']['post']['requestBody']['content']['application/json'];
export type NewPhoto = paths['/v1/photos']['post']['requestBody']['content']['application/json'];
export type PhotoUpload = Json<'/v1/photos', 'post'>;
export type Photo = Json<'/v1/photos/{id}', 'get'>;
export type Quiz = Json<'/v1/profile/quiz', 'get'>;
export type ProfileView = Json<'/v1/profile', 'get'>;
export type ProfileAnswers = paths['/v1/profile']['put']['requestBody']['content']['application/json'];
export type OutfitFeedback =
  paths['/v1/outfits/{id}/feedback']['patch']['requestBody']['content']['application/json'];
export type RatedOutfit = Json<'/v1/outfits/{id}/feedback', 'patch'>;
export type Memory = Json<'/v1/memory', 'get'>;
export type Note = Memory['notes'][number];

/** Sends the file straight to storage at the presigned URL. The API never receives it. */
export async function uploadPhoto(upload: PhotoUpload['upload'], file: Blob): Promise<void> {
  let res: Response;
  try {
    res = await fetch(upload.url, { method: upload.method, headers: upload.headers, body: file });
  } catch {
    throw new ApiError(0, 'network');
  }
  if (!res.ok) throw new ApiError(res.status, res.statusText);
}

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
  createItem: async (token: string, item: NewItem) =>
    (await (await post('/v1/wardrobe/items', item, token)).json()) as WardrobeItem,
  startUpload: async (token: string, photo: NewPhoto) =>
    (await (await post('/v1/photos', photo, token)).json()) as PhotoUpload,
  completeUpload: async (token: string, id: string) =>
    (await (await request(`/v1/photos/${id}/complete`, { method: 'POST', token })).json()) as Photo,
  photo: async (token: string, id: string) =>
    (await (await request(`/v1/photos/${id}`, { token })).json()) as Photo,
  quiz: async (token: string) => (await (await request('/v1/profile/quiz', { token })).json()) as Quiz,
  profile: async (token: string) => (await (await request('/v1/profile', { token })).json()) as ProfileView,
  rateOutfit: async (token: string, id: string, feedback: OutfitFeedback) =>
    (await (
      await request(`/v1/outfits/${id}/feedback`, { method: 'PATCH', body: JSON.stringify(feedback), token })
    ).json()) as RatedOutfit,
  memory: async (token: string) => (await (await request('/v1/memory', { token })).json()) as Memory,
  forgetNote: async (token: string, id: string) => {
    await request(`/v1/memory/${id}`, { method: 'DELETE', token });
  },
  forgetAll: async (token: string) => {
    await request('/v1/memory', { method: 'DELETE', token });
  },
  saveProfile: async (token: string, answers: ProfileAnswers) =>
    (await (
      await request('/v1/profile', { method: 'PUT', body: JSON.stringify(answers), token })
    ).json()) as ProfileView,
};
