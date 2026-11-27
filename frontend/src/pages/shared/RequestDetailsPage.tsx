import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { changeRequestCategory, fetchActiveCategories } from '../../api/admin';
import { errorMessage } from '../../api/client';
import { categoryLabel, formatDateTime, PRIORITY_LABELS, REJECT_REASON_LABELS } from '../../api/labels';
import {
  changeStatus,
  confirmRequest,
  fetchExecutors,
  fetchRequest,
  reopenRequest,
  type StatusChangePayload,
} from '../../api/requests';
import type {
  CategoryOption,
  ExecutorOption,
  RejectReason,
  RequestDetails,
  Role,
} from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { HistoryTimeline } from '../../components/HistoryTimeline';
import { MapPicker } from '../../components/MapPicker';
import { Modal } from '../../components/Modal';
import { StatusBadge } from '../../components/StatusBadge';
import { ErrorBox, Spinner } from '../../components/Spinner';

interface ActionsProps {
  request: RequestDetails;
  role: Role;
  userId: string;
  onUpdated: (request: RequestDetails) => void;
}

/**
 * Панель действий по матрице v2 (docs/07-roles-and-statuses.md):
 * оператор — передать в службу или отклонить с причиной; исполнитель — взять, приостановить,
 * возобновить, выполнить или вернуть оператору; житель — подтвердить результат или вернуть в работу.
 * Сервер всё равно проверяет права и переход (TC-4, TC-12, TC-15).
 */
function RequestActions({ request, role, userId, onUpdated }: ActionsProps) {
  const [executors, setExecutors] = useState<ExecutorOption[]>([]);
  const [assigneeId, setAssigneeId] = useState('');
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState<RejectReason>('DUPLICATE');
  const [resumeDate, setResumeDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // BL-T5: необратимые действия подтверждаем в модальном окне.
  const [confirming, setConfirming] = useState<'reject' | 'reopen' | null>(null);

  const status = request.status;
  const isOperator = role === 'OPERATOR';
  const isMyTask = request.assignee?.id === userId;
  const isExecutor = role === 'EXECUTOR' && isMyTask;
  const isAuthor = role === 'RESIDENT' && request.author.id === userId;

  const canDispatch = isOperator && status === 'NEW';
  const canReject = isOperator && (status === 'NEW' || status === 'VERIFIED');
  const canTake = isExecutor && status === 'VERIFIED';
  const canPause = isExecutor && status === 'IN_PROGRESS';
  const canResume = isExecutor && status === 'PENDING';
  const canResolve = isExecutor && status === 'IN_PROGRESS';
  const canReturn = isExecutor && (status === 'IN_PROGRESS' || status === 'PENDING');
  const canConfirm = isAuthor && status === 'RESOLVED' && !request.confirmedAt;
  const canReopen = isAuthor && status === 'RESOLVED';

  const showComment = canReject || canPause || canResume || canResolve || canReturn || canReopen;
  const commentLabel = canReject
    ? 'Причина отказа словами (для «Другое» — обязательно)'
    : canPause
      ? 'Почему приостановлено (обязательно)'
      : canResolve
        ? 'Что сделано (обязательно)'
        : canReturn
          ? 'Почему возвращаете оператору'
          : canReopen
            ? 'Что не так: проблема осталась'
            : 'Комментарий (по желанию)';

  useEffect(() => {
    if (!canDispatch) {
      return;
    }
    let cancelled = false;
    fetchExecutors()
      .then((list) => {
        if (cancelled) return;
        setExecutors(list);
        setAssigneeId((current) => current || list[0]?.id || '');
      })
      .catch((problem) => {
        if (!cancelled) setError(errorMessage(problem));
      });
    return () => {
      cancelled = true;
    };
  }, [canDispatch]);

  if (
    !canDispatch &&
    !canReject &&
    !canTake &&
    !canPause &&
    !canResume &&
    !canResolve &&
    !canReturn &&
    !canConfirm &&
    !canReopen
  ) {
    return null;
  }

  const run = async (action: () => Promise<RequestDetails>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      onUpdated(await action());
      setComment('');
      setResumeDate('');
      return true;
    } catch (problem) {
      setError(errorMessage(problem));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const send = (payload: StatusChangePayload) => run(() => changeStatus(request.id, payload));

  const confirmDialog = async () => {
    if (confirming === 'reject') {
      await send({ status: 'REJECTED', reasonCode: reason, comment: comment.trim() || undefined });
    } else if (confirming === 'reopen') {
      await run(() => reopenRequest(request.id, comment.trim() || undefined));
    }
    setConfirming(null);
  };

  return (
    <div className="card actions">
      <h2>Действия</h2>

      {canDispatch ? (
        <label className="field">
          <span>Исполнитель службы</span>
          <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
            {executors.map((executor) => (
              <option key={executor.id} value={executor.id}>
                {executor.fullName}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {canReject ? (
        <label className="field">
          <span>Причина отказа</span>
          <select value={reason} onChange={(event) => setReason(event.target.value as RejectReason)}>
            {(Object.keys(REJECT_REASON_LABELS) as RejectReason[]).map((code) => (
              <option key={code} value={code}>
                {REJECT_REASON_LABELS[code].ru} / {REJECT_REASON_LABELS[code].en}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {showComment ? (
        <label className="field">
          <span>{commentLabel}</span>
          <textarea
            rows={3}
            value={comment}
            maxLength={500}
            onChange={(event) => setComment(event.target.value)}
          />
        </label>
      ) : null}

      {canPause ? (
        <label className="field">
          <span>Планируемая дата возобновления (необязательно)</span>
          <input type="date" value={resumeDate} onChange={(event) => setResumeDate(event.target.value)} />
        </label>
      ) : null}

      {error ? <ErrorBox message={error} /> : null}

      <div className="actions__row">
        {canDispatch ? (
          <button
            type="button"
            className="button button--primary"
            disabled={busy || !assigneeId}
            onClick={() => void send({ status: 'VERIFIED', assigneeId, comment: comment.trim() || undefined })}
          >
            Передать в службу
          </button>
        ) : null}

        {canTake ? (
          <button
            type="button"
            className="button button--primary"
            disabled={busy}
            onClick={() => void send({ status: 'IN_PROGRESS', comment: comment.trim() || undefined })}
          >
            Взять в работу
          </button>
        ) : null}

        {canResume ? (
          <button
            type="button"
            className="button button--primary"
            disabled={busy}
            onClick={() => void send({ status: 'IN_PROGRESS', comment: comment.trim() || undefined })}
          >
            Возобновить
          </button>
        ) : null}

        {canResolve ? (
          <button
            type="button"
            className="button button--primary"
            disabled={busy || comment.trim().length === 0}
            onClick={() => void send({ status: 'RESOLVED', comment: comment.trim() })}
          >
            Выполнено
          </button>
        ) : null}

        {canPause ? (
          <button
            type="button"
            className="button button--secondary"
            disabled={busy || comment.trim().length === 0}
            onClick={() =>
              void send({ status: 'PENDING', comment: comment.trim(), resumeDate: resumeDate || undefined })
            }
          >
            Приостановить
          </button>
        ) : null}

        {canReturn ? (
          <button
            type="button"
            className="button button--secondary"
            disabled={busy}
            onClick={() => void send({ status: 'VERIFIED', comment: comment.trim() || undefined })}
          >
            Вернуть оператору
          </button>
        ) : null}

        {canConfirm ? (
          <button
            type="button"
            className="button button--primary"
            disabled={busy}
            onClick={() => void run(() => confirmRequest(request.id))}
          >
            Подтвердить результат
          </button>
        ) : null}

        {canReopen ? (
          <button
            type="button"
            className="button button--secondary"
            disabled={busy}
            onClick={() => setConfirming('reopen')}
          >
            Проблема осталась
          </button>
        ) : null}

        {canReject ? (
          <button
            type="button"
            className="button button--danger"
            disabled={busy || (reason === 'OTHER' && comment.trim().length === 0)}
            onClick={() => setConfirming('reject')}
          >
            Отклонить
          </button>
        ) : null}
      </div>

      <Modal
        open={confirming !== null}
        title={confirming === 'reject' ? 'Отклонить заявку?' : 'Вернуть заявку в работу?'}
        confirmLabel={confirming === 'reject' ? 'Отклонить' : 'Вернуть в работу'}
        danger={confirming === 'reject'}
        busy={busy}
        onConfirm={() => void confirmDialog()}
        onCancel={() => setConfirming(null)}
      >
        {confirming === 'reject' ? (
          <p>
            Заявка будет закрыта с причиной «{REJECT_REASON_LABELS[reason].ru}». Причина и комментарий
            останутся в истории и журнале действий.
          </p>
        ) : (
          <p>Заявка вернётся в работу, исполнитель получит её снова. Комментарий останется в истории.</p>
        )}
      </Modal>
    </div>
  );
}

/**
 * BL-T1 п.3: администратор исправляет категорию заявки, если оператор ошибся.
 * Категория = служба, поэтому при смене нужен исполнитель новой службы: сервер требует его
 * для заявок, которые уже в работе, и снимает прежнего исполнителя у новых.
 */
function AdminCategoryPanel({
  request,
  onUpdated,
}: {
  request: RequestDetails;
  onUpdated: (request: RequestDetails) => void;
}) {
  const [options, setOptions] = useState<CategoryOption[]>([]);
  const [executors, setExecutors] = useState<ExecutorOption[]>([]);
  const [category, setCategory] = useState<string>(request.category);
  const [assigneeId, setAssigneeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchActiveCategories(), fetchExecutors()])
      .then(([categories, executorsList]) => {
        if (cancelled) return;
        setOptions(categories);
        setExecutors(executorsList);
      })
      .catch((problem) => {
        if (!cancelled) setError(errorMessage(problem));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Текущая категория могла быть отключена в справочнике — её всё равно показываем в списке.
  const selectable = options.some((option) => option.code === request.category)
    ? options
    : [{ code: request.category, name: categoryLabel(request.category) }, ...options];

  const working = ['VERIFIED', 'IN_PROGRESS', 'PENDING', 'RESOLVED'].includes(request.status);
  const currentService = request.assignee?.service?.code ?? null;
  const changed = category !== request.category;
  const needsExecutor = changed && working && currentService !== category;
  const candidates = executors.filter((executor) => executor.service?.code === category);
  const canApply = changed && !busy && (needsExecutor ? Boolean(assigneeId) : true);

  const apply = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await changeRequestCategory(request.id, {
        category,
        ...(assigneeId ? { assigneeId } : {}),
      });
      onUpdated(updated);
      setAssigneeId('');
      setNotice(`Категория изменена: ${categoryLabel(updated.category)}.`);
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>Категория заявки</h2>
      <p className="page__subtitle">
        Сейчас: {categoryLabel(request.category)}. Смена категории меняет службу-исполнителя; история заявки
        сохраняется, изменение попадает в журнал действий.
      </p>

      <label className="field">
        <span>Новая категория / служба</span>
        <select
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setAssigneeId('');
            setNotice(null);
          }}
        >
          {selectable.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
        </select>
      </label>

      {needsExecutor ? (
        <label className="field">
          <span>Исполнитель новой службы (обязательно)</span>
          <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
            <option value="">— выберите исполнителя —</option>
            {candidates.map((executor) => (
              <option key={executor.id} value={executor.id}>
                {executor.fullName}
              </option>
            ))}
          </select>
          {candidates.length === 0 ? (
            <span className="field__hint">У этой службы нет активных исполнителей — назначьте его в пользователях.</span>
          ) : null}
        </label>
      ) : null}

      {error ? <ErrorBox message={error} /> : null}
      {notice ? <p className="notice">{notice}</p> : null}

      <div className="actions__row">
        <button type="button" className="button button--primary" disabled={!canApply} onClick={() => void apply()}>
          {busy ? 'Сохраняем…' : 'Применить категорию'}
        </button>
      </div>
    </div>
  );
}

/** Карточка заявки: данные, карта, фото и история — для всех ролей (FR-5). */
export function RequestDetailsPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [request, setRequest] = useState<RequestDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRequest(await fetchRequest(id));
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <Spinner label="Загружаем заявку…" />;
  }

  if (error || !request || !user) {
    return (
      <section className="page">
        <ErrorBox message={error ?? 'Заявка не найдена'} onRetry={() => void load()} />
        <Link className="button button--secondary" to="/">
          На главную
        </Link>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page__head">
        <div>
          <button type="button" className="page__back" onClick={() => navigate(-1)}>
            ← Назад
          </button>
          <h1>
            №{request.number} · {request.title}
          </h1>
          <p className="page__subtitle">
            {categoryLabel(request.category)} · {PRIORITY_LABELS[request.priority].ru} · {request.address}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div className="detail">
        <div className="detail__main">
          <div className="card">
            <h2>Описание</h2>
            <p className="detail__text">{request.description}</p>

            <dl className="detail__meta">
              <div>
                <dt>Житель</dt>
                <dd>{request.author.fullName}</dd>
              </div>
              <div>
                <dt>Исполнитель</dt>
                <dd>{request.assignee?.fullName ?? 'не назначен'}</dd>
              </div>
              <div>
                <dt>Создана</dt>
                <dd>{formatDateTime(request.createdAt)}</dd>
              </div>
              <div>
                <dt>Обновлена</dt>
                <dd>{formatDateTime(request.updatedAt)}</dd>
              </div>
              {request.resolvedAt ? (
                <div>
                  <dt>Выполнена</dt>
                  <dd>{formatDateTime(request.resolvedAt)}</dd>
                </div>
              ) : null}
              {request.confirmedAt ? (
                <div>
                  <dt>Подтверждена жителем</dt>
                  <dd>{formatDateTime(request.confirmedAt)}</dd>
                </div>
              ) : null}
              {request.reopenCount > 0 ? (
                <div>
                  <dt>Возвратов в работу</dt>
                  <dd>{request.reopenCount}</dd>
                </div>
              ) : null}
              {request.rejectReason ? (
                <div>
                  <dt>Причина отказа</dt>
                  <dd>
                    {REJECT_REASON_LABELS[request.rejectReason as RejectReason]?.ru ?? request.rejectReason}
                  </dd>
                </div>
              ) : null}
              {request.resumeDate ? (
                <div>
                  <dt>Возобновление</dt>
                  <dd>{formatDateTime(request.resumeDate)}</dd>
                </div>
              ) : null}
            </dl>

            {request.photoUrl ? (
              <a href={request.photoUrl} target="_blank" rel="noreferrer">
                <img className="detail__photo" src={request.photoUrl} alt={`Фото к заявке №${request.number}`} />
              </a>
            ) : (
              <p className="detail__hint">Фото не приложено</p>
            )}
          </div>

          <div className="card">
            <h2>Место заявки</h2>
            <MapPicker value={{ lat: request.lat, lng: request.lng }} height="260px" />
          </div>
        </div>

        <aside className="detail__side">
          {user.role === 'ADMIN' ? <AdminCategoryPanel request={request} onUpdated={setRequest} /> : null}

          <RequestActions request={request} role={user.role} userId={user.id} onUpdated={setRequest} />

          <div className="card">
            <h2>История</h2>
            <HistoryTimeline history={request.history} />
          </div>
        </aside>
      </div>
    </section>
  );
}
