import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { json, mockApi, tokens } from './test/fake-api';

describe('App', () => {
  it('signs in, opens on the wardrobe, and signs out again', async () => {
    const calls = mockApi({
      'POST /v1/auth/login': () => json(tokens),
      'GET /v1/wardrobe/items': () => json({ items: [] }),
      'POST /v1/auth/logout': () => new Response(null, { status: 204 }),
    });
    render(<App />);

    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'a-long-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Your wardrobe' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wardrobe' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByText('Nothing here yet')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.getByRole('heading', { name: 'Sign in to Capsule' })).toBeInTheDocument();
    expect(calls.map((c) => `${c.method} ${c.path}`)).toContain('POST /v1/auth/logout');
  });

  it('signs the person out when their session cannot be refreshed', async () => {
    mockApi({
      'POST /v1/auth/login': () => json(tokens),
      'GET /v1/wardrobe/items': () => json({ message: 'Unauthorized' }, 401),
      'POST /v1/auth/refresh': () => json({ message: 'Invalid refresh token' }, 401),
    });
    render(<App />);

    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'a-long-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Your session ended. Sign in again to continue.')).toBeInTheDocument();
  });
});
