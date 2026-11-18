import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockApi, tokens } from '../../test/fake-api';
import { AuthScreen } from './AuthScreen';

describe('AuthScreen', () => {
  it('signs in and hands back the session with a normalised email', async () => {
    const calls = mockApi({ 'POST /v1/auth/login': () => json(tokens) });
    const onSignedIn = vi.fn();
    render(<AuthScreen onSignedIn={onSignedIn} />);

    await userEvent.type(screen.getByLabelText('Email'), '  Ana@Example.com ');
    await userEvent.type(screen.getByLabelText('Password'), 'a-long-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(calls[0].body).toEqual({ email: 'Ana@Example.com', password: 'a-long-password' });
    expect(onSignedIn).toHaveBeenCalledWith({ email: 'ana@example.com', tokens });
  });

  it('switches to registration and calls the register endpoint', async () => {
    const calls = mockApi({ 'POST /v1/auth/register': () => json(tokens, 201) });
    const onSignedIn = vi.fn();
    render(<AuthScreen onSignedIn={onSignedIn} />);

    await userEvent.click(screen.getByRole('button', { name: 'No account yet? Create one' }));
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    expect(screen.getByText('At least 10 characters.')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com');
    await userEvent.type(screen.getByLabelText(/^Password/), 'a-long-password');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(calls[0].path).toBe('/v1/auth/register');
    expect(onSignedIn).toHaveBeenCalled();
  });

  it("shows the API's message when credentials are wrong", async () => {
    mockApi({ 'POST /v1/auth/login': () => json({ message: 'Invalid email or password' }, 401) });
    const onSignedIn = vi.fn();
    render(<AuthScreen onSignedIn={onSignedIn} />);

    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it('explains what to check when the API cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    render(<AuthScreen onSignedIn={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'a-long-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/capsule-api is running/);
  });

  it('keeps the button disabled until both fields are filled', async () => {
    render(<AuthScreen onSignedIn={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Sign in' });
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com');
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Password'), 'x');
    expect(button).toBeEnabled();
  });
});
