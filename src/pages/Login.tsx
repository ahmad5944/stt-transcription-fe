import { useState } from 'react';
import type { FormEvent } from 'react';
import { login, register } from '../services/authClient';
import './Login.css';

interface LoginProps {
  onAuthenticated: (accessToken: string) => void;
}

export function Login({ onAuthenticated }: LoginProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const auth = mode === 'login' ? await login(email, password) : await register(email, password);
      localStorage.setItem('accessToken', auth.accessToken);
      localStorage.setItem('userEmail', auth.email);
      localStorage.setItem('userId', auth.userId);
      onAuthenticated(auth.accessToken);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-shell">
        <aside className="login-hero">
          <div className="login-hero-copy">
            <span className="login-hero-kicker">Bluetooth Meeting</span>
            <h1>Audio streaming, transcription, dan PiP dalam satu workspace.</h1>
            <p>
              Pantau perangkat, mulai rekaman, lihat transkrip live, dan kelola hasil rekaman dalam tampilan yang rapi dan responsif.
            </p>
          </div>

          <div className="login-hero-card">
            <span className="login-hero-badge">🎙</span>
            <div>
              <strong>Live audio controls</strong>
              <p>Device selection, level meter, dan PiP controls tetap sinkron.</p>
            </div>
          </div>
        </aside>

        <main className="login-panel">
          <div className="login-card">
            <div className="login-brand">
              <span className="mic-badge">🎙</span>
              <div>
                <h1>{mode === 'login' ? 'Masuk' : 'Daftar Akun'}</h1>
                <p>Bluetooth Microphone Testing</p>
              </div>
            </div>

            <form className="login-form" onSubmit={handleSubmit}>
              <label className="login-field">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>

              <label className="login-field">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                />
              </label>

              {error && <p className="login-error">{error}</p>}

              <button type="submit" className="login-submit" disabled={isSubmitting}>
                {isSubmitting ? 'Memproses...' : mode === 'login' ? 'Login' : 'Daftar'}
              </button>
            </form>

            <p className="login-switch">
              {mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setError(null);
                }}
              >
                {mode === 'login' ? 'Daftar di sini' : 'Login di sini'}
              </button>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
