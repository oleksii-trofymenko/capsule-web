import { createContext, useContext } from 'react';

/**
 * Runs an API call with the signed-in user's access token, refreshing it once
 * if it expired. Screens use this instead of handling tokens themselves.
 */
export type AuthedCall = <T>(call: (accessToken: string) => Promise<T>) => Promise<T>;

export const SessionContext = createContext<AuthedCall | null>(null);

export function useAuthedCall(): AuthedCall {
  const call = useContext(SessionContext);
  if (!call) throw new Error('useAuthedCall must be used inside a signed-in session');
  return call;
}
