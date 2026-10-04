import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { Nuqta } from '../../components/ui/Ornament';
import { env } from '../../config/env';
import { useAuth } from '../../state/AuthContext';

export function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-brand">
        <img src="/brand/zainab-logo.png" alt="Zainab Henna logo" width={260} height={260} />
        <p className="login-tag">
          <Nuqta size={9} /> Henna artistry, Venezuela <Nuqta size={9} />
        </p>
      </div>
      <div className="login-panel">
        <form className="login-form" onSubmit={submit} noValidate>
          <h1>Sign in to the studio</h1>
          <p className="text-2">Leads, bookings and clients in one place.</p>
          {error && (
            <div className="form-alert" role="alert">
              {error}
            </div>
          )}
          <Field label="Email">
            {(p) => <Input {...p} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Field label="Password">
            {(p) => <Input {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <Button type="submit" variant="primary" block loading={busy}>
            Sign in
          </Button>
          {env.dataSource === 'local' && env.showDemoLogin && (
            <div className="login-demo">
              <p>
                Demo access: <code>{env.demoEmail}</code> / <code>{env.demoPassword}</code>
              </p>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setEmail(env.demoEmail);
                  setPassword(env.demoPassword);
                }}
              >
                Fill in demo details
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
