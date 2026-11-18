import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { SessionContext, type AuthedCall } from '../features/auth/SessionContext';
import { tokens } from './fake-api';

/** Renders a screen as a signed-in user would see it, with a fresh query cache and no retries. */
export function renderSignedIn(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const call: AuthedCall = (run) => run(tokens.accessToken);
  return render(
    <QueryClientProvider client={client}>
      <SessionContext.Provider value={call}>{ui}</SessionContext.Provider>
    </QueryClientProvider>,
  );
}
