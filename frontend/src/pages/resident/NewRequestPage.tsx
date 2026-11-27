import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchActiveCategories } from '../../api/admin';
import { errorMessage } from '../../api/client';
import { mergeCategories, PRIORITY_LABELS } from '../../api/labels';
import { createRequest } from '../../api/requests';
import type { Priority } from '../../api/types';
import { MapPicker, type LatLng } from '../../components/MapPicker';
import { ErrorBox } from '../../components/Spinner';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** FR-2 / TC-1…TC-3: заявка с фото и точкой на карте. */
export function NewRequestPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'ROADS',
    priority: 'NORMAL' as Priority,
    address: '',
  });
  // BL-T1 п.2 / TC-26: отключённые категории жителю не показываются.
  const [categories, setCategories] = useState(() => mergeCategories([]));
  const [point, setPoint] = useState<LatLng | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchActiveCategories()
      .then((active) => {
        if (cancelled) return;
        const list = mergeCategories(active);
        setCategories(list);
        setForm((current) =>
          list.some((option) => option.code === current.category)
            ? current
            : { ...current, category: list[0]?.code ?? current.category },
        );
      })
      .catch(() => {
        // Справочник недоступен — остаётся встроенный список, заявку создать можно.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pickPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file && !ALLOWED_TYPES.includes(file.type)) {
      // TC-3: то же сообщение, что и на сервере
      setPhoto(null);
      setError('Недопустимый тип файла. Разрешены JPG, PNG, WEBP / unsupported file type');
      return;
    }
    setError(null);
    setPhoto(file);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    // TC-2: без точки на карте заявка не уходит на сервер
    if (!point) {
      setError('Укажите место на карте / specify a location on the map');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const created = await createRequest({
        ...form,
        lat: point.lat,
        lng: point.lng,
        photo,
      });
      navigate(`/requests/${created.id}`, { replace: true });
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page">
      <div className="page__head">
        <div>
          <h1>Новая заявка</h1>
          <p className="page__subtitle">Опишите проблему, поставьте точку на карте и приложите фото</p>
        </div>
      </div>

      <form className="card form" onSubmit={submit}>
        <label className="field">
          <span>Название</span>
          <input
            type="text"
            value={form.title}
            required
            minLength={5}
            maxLength={120}
            placeholder="Например: яма на дороге у дома 15"
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </label>

        <div className="form__row">
          <label className="field">
            <span>Категория / служба</span>
            <select
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            >
              {categories.map((category) => (
                <option key={category.code} value={category.code}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Приоритет</span>
            <select
              value={form.priority}
              onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })}
            >
              {(Object.keys(PRIORITY_LABELS) as Priority[]).map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABELS[priority].ru} / {PRIORITY_LABELS[priority].en}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span>Адрес словами</span>
          <input
            type="text"
            value={form.address}
            required
            minLength={3}
            maxLength={200}
            placeholder="ул. Ленина, 15"
            onChange={(event) => setForm({ ...form, address: event.target.value })}
          />
        </label>

        <div className="field">
          <span>Место на карте (обязательно)</span>
          <MapPicker value={point} onChange={setPoint} height="340px" />
        </div>

        <label className="field">
          <span>Описание</span>
          <textarea
            rows={5}
            value={form.description}
            required
            minLength={10}
            maxLength={2000}
            placeholder="Что случилось, чем это мешает, как давно"
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </label>

        <label className="field">
          <span>Фото (JPG, PNG или WEBP, до 5 МБ)</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pickPhoto} />
          {photo ? <span className="field__hint">Выбран файл: {photo.name}</span> : null}
        </label>

        {error ? <ErrorBox message={error} /> : null}

        <div className="form__actions">
          <button type="button" className="button button--secondary" onClick={() => navigate('/my')}>
            Отмена
          </button>
          <button type="submit" className="button button--primary" disabled={busy}>
            {busy ? 'Отправляем…' : 'Отправить заявку'}
          </button>
        </div>
      </form>
    </section>
  );
}
