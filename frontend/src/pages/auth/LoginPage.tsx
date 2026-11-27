import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { HOME_BY_ROLE, ROLE_LABELS } from '../../api/labels';
import { useAuth } from '../../auth/AuthContext';
import { ErrorBox } from '../../components/Spinner';

/** FR-1 / TC-7: вход по ролям, неверный пароль даёт понятное сообщение. */
export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) {
    return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const signedIn = await login(email, password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? HOME_BY_ROLE[signedIn.role], { replace: true });
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth__card">
        <h1 className="auth__brand">
          City<span>Fix</span>
        </h1>
        <p className="auth__subtitle">Заявки жителей: от «Новая» до «Выполнена»</p>

        <form className="form" onSubmit={submit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              autoComplete="username"
              required
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Пароль</span>
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              required
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error ? <ErrorBox message={error} /> : null}

          <button type="submit" className="button button--primary" disabled={busy}>
            {busy ? 'Входим…' : 'Войти'}
          </button>
        </form>

        <p className="auth__link">
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </p>

        <div className="auth__hint">
          <p>Тестовые входы / test logins:</p>
          <ul>
            {(Object.keys(ROLE_LABELS) as Array<keyof typeof ROLE_LABELS>).map((role) => (
              <li key={role}>
                <strong>{ROLE_LABELS[role].ru}:</strong>{' '}
                {role.toLowerCase()}@cityfix.local · {role.charAt(0) + role.slice(1).toLowerCase()}123!
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
