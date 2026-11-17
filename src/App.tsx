import { useCallback, useState } from 'react';
import { api } from './api/client';
import { AuthScreen } from './features/auth/AuthScreen';
import type { Session } from './features/auth/session';
import { ChatScreen } from './features/chat/ChatScreen';
import { en } from './strings/en';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState<string | undefined>();

  const onTokens = useCallback(
    (tokens: Session['tokens']) => setSession((s) => (s ? { ...s, tokens } : s)),
    [],
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

  return (
    <ChatScreen
      session={session}
      onTokens={onTokens}
      onSessionEnded={() => {
        setNotice(en.auth.sessionEnded);
        setSession(null);
      }}
      onSignOut={() => {
        // Revoke on the server too; the screen changes whether or not that succeeds.
        void api.logout(session.tokens.refreshToken).catch(() => undefined);
        setSession(null);
      }}
    />
  );
}
