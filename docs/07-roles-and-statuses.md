# 6. Роли, права и переходы статусов / Roles, rights and status transitions

The presentation does not say exactly **who** changes **which** status. This document is the
team's version, and it is implemented on the server in
`backend/src/services/request.service.ts` — the client only mirrors it.

## 6.1 Матрица прав / Permission matrix

| Действие / Action | Житель RESIDENT | Оператор OPERATOR | Исполнитель EXECUTOR | Администратор ADMIN |
| --- | --- | --- | --- | --- |
| Регистрация и вход / register & login | ✔ | ✔ (создаётся админом) | ✔ (создаётся админом) | ✔ |
| Создать заявку / create request | ✔ | ✘ | ✘ | ✘ |
| Список заявок / list | только свои / own only | все / all | назначенные ему / assigned | все / all |
| Карточка заявки / details | только своя (иначе `403`) | любая | только назначенная (иначе `403`) | любая |
| Передать в службу `NEW → VERIFIED` | ✘ | ✔ | ✘ | ✘ |
| Отклонить `NEW/VERIFIED → REJECTED` (с причиной) | ✘ | ✔ | ✘ | ✘ |
| Взять в работу `VERIFIED → IN_PROGRESS` | ✘ | ✘ | ✔ (своя) | ✘ |
| Приостановить `IN_PROGRESS → PENDING` (комментарий + дата) | ✘ | ✘ | ✔ (своя) | ✘ |
| Возобновить `PENDING → IN_PROGRESS` | ✘ | ✘ | ✔ (своя) | ✘ |
| Выполнить `IN_PROGRESS → RESOLVED` (комментарий) | ✘ | ✘ | ✔ (своя) | ✘ |
| Вернуть оператору `IN_PROGRESS/PENDING → VERIFIED` | ✘ | ✘ | ✔ (своя) | ✘ |
| Подтвердить результат (флаг `confirmed_at`) | ✔ (автор) | ✘ | ✘ | ✘ |
| Вернуть в работу `RESOLVED → VERIFIED` | ✔ (автор) | ✘ | ✘ | ✘ |
| Сводка по статусам / stats | ✘ | ✔ | ✘ | ✔ |
| Список исполнителей / executors | ✘ | ✔ | ✘ | ✔ |
| Сменить категорию (службу) заявки / reassign category | ✘ | ✘ | ✘ | ✔ |
| Экспорт заявок в CSV по фильтру / CSV export | ✘ | ✘ | ✘ | ✔ |
| Создать оператора/исполнителя, сменить роль, блокировка, сброс пароля | ✘ | ✘ | ✘ | ✔ |
| Справочники служб и категорий: создать, изменить, отключить | ✘ | ✘ | ✘ | ✔ |
| Журнал действий / audit log | ✘ | ✘ | ✘ | ✔ (только чтение) |

Регистрация через `POST /api/auth/register` всегда создаёт `RESIDENT`; оператора, исполнителя и
администратора создаёт администратор в разделе «Пользователи» (`POST /api/admin/users`).

## 6.1.1 Права администратора (BL-T1)

Все маршруты `/api/admin/*`, кроме `GET /stats`, закрыты одним `requireRole('ADMIN')` на роутере —
интерфейс лишь повторяет серверную проверку.

| Правило | Поведение сервера |
| --- | --- |
| Смена собственной роли | `409` — администратор не разжаловывает себя |
| Блокировка собственной учётной записи | `409` — иначе можно потерять доступ к панели |
| Разжаловать или заблокировать последнего активного админа | `409` — в системе всегда есть хотя бы один |
| Исполнитель без службы | `400` при создании и при смене роли на `EXECUTOR` |
| Блокировка пользователя | `is_active = false`: вход `403`, уже выданный токен — `401` |
| Удаление справочника | запрещено: только `is_active = false`, история заявок остаётся |
| Смена категории заявки в работе | нужен исполнитель новой службы (`400` без него); на `NEW` прежний снимается |
| Журнал действий | только `GET`: API не имеет маршрутов изменения или удаления записей |

## 6.2 Матрица переходов / Transition matrix

`from → to`, and which role may perform it:

| From \ To | `VERIFIED` | `IN_PROGRESS` | `PENDING` | `RESOLVED` | `REJECTED` |
| --- | --- | --- | --- | --- | --- |
| `NEW` | OPERATOR (в службу) | — | — | — | OPERATOR |
| `VERIFIED` | — | EXECUTOR (assignee) | — | — | OPERATOR |
| `IN_PROGRESS` | EXECUTOR (возврат оператору) | — | EXECUTOR | EXECUTOR | — |
| `PENDING` | EXECUTOR (возврат оператору) | EXECUTOR (возобновление) | — | — | — |
| `RESOLVED` | RESIDENT (автор, возврат в работу) | — | — | — | — |
| `REJECTED` | — | — | — | — | — |

Labels shown in the UI (`frontend/src/api/labels.ts`): `NEW` «Новая», `VERIFIED` «Проверена»,
`IN_PROGRESS` «В процессе», `PENDING` «Ожидает», `RESOLVED` «Выполнена», `REJECTED` «Отклонена»;
priorities: `LOW` «Низкий», `NORMAL` «Обычный», `HIGH` «Высокий», `URGENT` «Срочный».

Порядок проверок на сервере: допустимость перехода (`409`) → право роли (`403`) → видимость
заявки (`403`). Поэтому чужая заявка в неподходящем статусе отвечает `409`, а не `403` —
так сохраняется поведение TC-9 из первой версии.

`confirmed_at` — флаг «житель подтвердил результат», а не отдельный статус: заявка остаётся
`RESOLVED`. Возврат в работу (`RESOLVED → VERIFIED`) увеличивает `reopen_count` и очищает
`resolved_at` и `confirmed_at`, поэтому после повторного выполнения житель может подтвердить
результат снова.

Any other combination → `409 Conflict` («Недопустимый переход статуса») for a valid role, and
`403 Forbidden` when the role has no right at all. The resident always gets `403`, which is TC-4.

## 6.3 Данные перехода / Transition payload

```http
PATCH /api/requests/:id/status
{ "status": "VERIFIED", "comment": "Передано в службу «Дороги»", "assigneeId": "<executor id>" }
```

- `comment` — необязательный для `NEW → VERIFIED`, обязателен для `PENDING` (причина паузы),
  `RESOLVED` (что сделано) и для отказа с причиной `OTHER` (иначе `400`);
- `assigneeId` — обязателен для `NEW → VERIFIED` (иначе `400`), задаёт службу-исполнителя;
- `reasonCode` — обязателен для `REJECTED`: `DUPLICATE`, `NOT_CITY_SERVICE`, `INSUFFICIENT_INFO`,
  `SPAM`, `OTHER` (иначе `400`); дублируется в `requests.reject_reason` и в историю;
- `resumeDate` — необязательная дата `YYYY-MM-DD` для `PENDING`, попадает в `requests.resume_date`;
  мусор в поле → `400`, пустая строка → `null`.

Подтверждение и возврат жителя идут отдельными действиями, без угадывания статуса:

```http
POST /api/requests/:id/confirm   # житель-автор, только RESOLVED, иначе 409; повторно — 409
POST /api/requests/:id/reopen    # житель-автор, только RESOLVED; тело: { "comment": "..." }
```

Each successful transition performs, in one transaction:

1. `UPDATE requests SET status, updated_at, resolved_at?, confirmed_at?, reject_reason?, resume_date?, reopen_count?`;
2. `INSERT INTO status_history (request_id, from_status, to_status, comment, reason_code, changed_by_id)`.

## 6.4 Кто что видит / Visibility rules

| Роль | `GET /api/requests` | `GET /api/requests/:id` |
| --- | --- | --- |
| RESIDENT | `authorId = me` | чужая заявка → `403` |
| EXECUTOR | `assigneeId = me` | чужая заявка → `403` |
| OPERATOR | все | любая |
| ADMIN | все | любая |

Visibility is enforced by `WHERE`-clauses built in `request.repository.ts` from the authenticated
user, never from a query parameter — a client cannot ask for someone else's data.

## 6.5 Открытые вопросы по ролям / Open questions

| Вопрос | Решение сейчас | Кто решает |
| --- | --- | --- |
| Нужен ли статус «Отклонена»? | добавлен, оператор отклоняет с причиной из справочника | команда, спринт 1 |
| Можно ли приостановить заявку? | да, `PENDING` с причиной и необязательной датой возобновления | команда, спринт 2 |
| Может ли администратор менять статус? | нет: статусы ведут оператор и исполнитель; админ исправляет только категорию (и службу) заявки | команда, спринт 4 (BL-T1) |
| Видит ли исполнитель все заявки службы или только назначенные? | только назначенные | команда, спринт 3 |
| Может ли оператор переназначить заявку? | нет: исполнитель задаётся при `NEW → VERIFIED`; исправить категорию и назначить исполнителя новой службы может администратор | команда, спринт 4 (BL-T1) |
