import { ApiError, api, type Tokens } from '../../api/client';

/**
 * Tokens are held in memory only: a page reload signs the user out, and
 * nothing readable by injected scripts is left in browser storage.
 */
export interface Session {
  email: string;
  tokens: Tokens;
}

export class SessionEndedError extends Error {}

/**
 * Runs a call with the access token. If the API says the token expired,
 * swaps the refresh token for a new pair once and retries.
 */
export async function withSession<T>(
  session: Session,
  onTokens: (tokens: Tokens) => void,
  call: (accessToken: string) => Promise<T>,
): Promise<T> {
  try {
    return await call(session.tokens.accessToken);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
  }
  let tokens: Tokens;
  try {
    tokens = await api.refresh(session.tokens.refreshToken);
  } catch {
    throw new SessionEndedError();
  }
  onTokens(tokens);
  return call(tokens.accessToken);
}
