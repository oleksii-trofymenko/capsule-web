import { useState, type FormEvent } from 'react';
import { ApiError, api, isNetworkError } from '../../api/client';
import { en } from '../../strings/en';
import type { Session } from './session';

interface Props {
  notice?: string;
  onSignedIn: (session: Session) => void;
}

export function AuthScreen({ notice, onSignedIn }: Props) {
  const t = en.auth;
  const [mode, setMode] = useState<'signIn' | 'register'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const credentials = { email: email.trim(), password };
      const tokens = mode === 'signIn' ? await api.login(credentials) : await api.register(credentials);
      onSignedIn({ email: credentials.email.toLowerCase(), tokens });
    } catch (e) {
      if (isNetworkError(e)) setError(en.errors.network);
      else if (e instanceof ApiError && e.status === 429) setError(en.errors.tooManyRequests);
      else if (e instanceof ApiError) setError(e.message);
      else setError(en.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <div className="auth-card">
        <h1 className="auth-title">{mode === 'signIn' ? t.signInTitle : t.registerTitle}</h1>
        <p className="auth-purpose">{en.appPurpose}</p>

        {notice && <p className="notice">{notice}</p>}

        <form onSubmit={submit} noValidate>
          <label className="field">
            <span>{t.email}</span>
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            <span>{t.password}</span>
            <input
              type="password"
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'register' ? 10 : undefined}
              aria-describedby={mode === 'register' ? 'password-hint' : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === 'register' && (
              <small id="password-hint" className="hint">
                {t.passwordHint}
              </small>
            )}
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button className="button primary" type="submit" disabled={busy || !email || !password}>
            {busy ? t.working : mode === 'signIn' ? t.signIn : t.register}
          </button>
        </form>

        <button
          className="link"
          type="button"
          onClick={() => {
            setMode(mode === 'signIn' ? 'register' : 'signIn');
            setError(null);
          }}
        >
          {mode === 'signIn' ? t.toRegister : t.toSignIn}
        </button>
      </div>
    </main>
  );
}
