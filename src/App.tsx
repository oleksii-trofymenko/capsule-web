import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { ApiError, api } from './api/client';
import { AuthScreen } from './features/auth/AuthScreen';
import { SessionContext, type AuthedCall } from './features/auth/SessionContext';
import { SessionEndedError, withSession, type Session } from './features/auth/session';
import { ChatScreen } from './features/chat/ChatScreen';
import { AppShell } from './features/shell/AppShell';
import { en } from './strings/en';

/** Server data stays fresh for 5 minutes: inside the API's 15-minute photo links. */
const FRESH_MS = 5 * 60_000;

const newQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: FRESH_MS,
        // A 4xx will not fix itself; retry only network and server errors.
        retry: (count, error) =>
          count < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      },
    },
  });

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState<string | undefined>();
  const [queryClient] = useState(newQueryClient);
  // Calls read the latest tokens, which a refresh may have replaced mid-session.
  const current = useRef(session);
  current.current = session;

  const onTokens = useCallback(
    (tokens: Session['tokens']) => setSession((s) => (s ? { ...s, tokens } : s)),
    [],
  );

  const endSession = useCallback(
    (message?: string) => {
      queryClient.clear();
      setNotice(message);
      setSession(null);
    },
    [queryClient],
  );

  const call = useCallback<AuthedCall>(
    async (run) => {
      const active = current.current;
      if (!active) throw new SessionEndedError();
      try {
        return await withSession(active, onTokens, run);
      } catch (error) {
        if (error instanceof SessionEndedError) endSession(en.auth.sessionEnded);
        throw error;
      }
    },
    [onTokens, endSession],
  );

  if (!session) {
    return (
      <AuthScreen
        notice={notice}
        onSignedIn={(next) => {
          setNotice(undefined);
          setSession(next);
        }}
      />
    );
  }

  const signOut = () => {
    // Revoke on the server too; the screen changes whether or not that succeeds.
    void api.logout(session.tokens.refreshToken).catch(() => undefined);
    endSession();
  };

  return (
    <QueryClientProvider client={queryClient}>
      <SessionContext.Provider value={call}>
        <AppShell
          email={session.email}
          onSignOut={signOut}
          fittingRoom={
            import.meta.env.DEV ? (
              <ChatScreen
                session={session}
                onTokens={onTokens}
                onSessionEnded={() => endSession(en.auth.sessionEnded)}
                onSignOut={signOut}
              />
            ) : null
          }
        />
      </SessionContext.Provider>
    </QueryClientProvider>
  );
}
