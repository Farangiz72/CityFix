import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { HOME_BY_ROLE } from '../../api/labels';
import { useAuth } from '../../auth/AuthContext';
import { ErrorBox } from '../../components/Spinner';

/** Регистрация всегда создаёт жителя (docs/07-roles-and-statuses.md). */
export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await register({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        phone: form.phone || undefined,
      });
      navigate(HOME_BY_ROLE[created.role], { replace: true });
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
        <p className="auth__subtitle">Регистрация жителя</p>

        <form className="form" onSubmit={submit}>
          <label className="field">
            <span>ФИО</span>
            <input
              type="text"
              value={form.fullName}
              required
              minLength={3}
              onChange={(event) => setForm({ ...form, fullName: event.target.value })}
            />
          </label>

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              autoComplete="username"
              required
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </label>

          <label className="field">
            <span>Телефон (необязательно)</span>
            <input
              type="tel"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </label>

          <label className="field">
            <span>Пароль (минимум 8 символов)</span>
            <input
              type="password"
              value={form.password}
              autoComplete="new-password"
              required
              minLength={8}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </label>

          {error ? <ErrorBox message={error} /> : null}

          <button type="submit" className="button button--primary" disabled={busy}>
            {busy ? 'Создаём…' : 'Создать аккаунт'}
          </button>
        </form>

        <p className="auth__link">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </div>
    </div>
  );
}
