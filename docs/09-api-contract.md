# Контракт API / API contract (sprint 1 deliverable)

Fixed in sprint 1 so the frontend can work on stubs while the backend is being built
(risk "the frontend waits for the backend").

Base URL: `/api` (through the nginx proxy in Docker, `http://localhost:4000/api` locally).
All responses are JSON. All timestamps are ISO-8601 UTC.

## 1. Аутентификация / Authentication

Every endpoint except `/health`, `/auth/register` and `/auth/login` requires:

```http
Authorization: Bearer <JWT>
```

The JWT payload carries `sub` (user id), `role` and `email`; the server re-reads the user on
sensitive operations, so a stale role in a token cannot be used to escalate.

| Метод | Путь | Роль | Тело / Body | Ответ |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | — | `{ email, password, fullName, phone? }` | `201 { token, user }` |
| POST | `/auth/login` | — | `{ email, password }` | `200 { token, user }`; `403`, если учётная запись заблокирована (BL-T1) |
| GET | `/auth/me` | любая | — | `200 { user }` |
| GET | `/health` | — | — | `200 { status: "ok", uptime }` |

`user`:

```json
{
  "id": "clx...",
  "email": "resident@cityfix.local",
  "fullName": "Иван Петров",
  "role": "RESIDENT",
  "phone": "+7 900 000-00-00",
  "createdAt": "2026-11-12T14:05:00.000Z"
}
```

`passwordHash` never leaves the server.

## 2. Заявки / Requests

### 2.1 Список / List

```http
GET /api/requests?status=NEW&category=ROADS&search=ленина&page=1&limit=20&sort=newest
```

| Параметр | Допустимые значения | По умолчанию |
| --- | --- | --- |
| `status` | `NEW` \| `VERIFIED` \| `IN_PROGRESS` \| `PENDING` \| `RESOLVED` \| `REJECTED` | все |
| `category` | любой активный код из справочника категорий, напр. `ROADS` | все |
| `serviceId` | служба-исполнитель: только заявки, назначенные исполнителям этой службы (BL-T1) | все |
| `dateFrom` / `dateTo` | `YYYY-MM-DD`, границы периода создания включительно (BL-T1) | без ограничения |
| `search` | строка, ищет по `title`, `address`, `number` | — |
| `page` | ≥ 1 | 1 |
| `limit` | 1…100 | 20 |
| `sort` | `newest` \| `oldest` | `newest` |

Scope is derived from the token, not from the query: resident → own, executor → assigned,
operator/admin → all.

```json
{
  "items": [
    {
      "id": "clx...",
      "number": 1042,
      "title": "Яма на дороге",
      "category": "ROADS",
      "priority": "NORMAL",
      "status": "NEW",
      "address": "ул. Ленина, 15",
      "lat": 55.7558,
      "lng": 37.6173,
      "photoUrl": "/uploads/1731-pothole.jpg",
      "author": { "id": "clx...", "fullName": "Иван Петров" },
      "assignee": null,
      "createdAt": "2026-11-12T14:05:00.000Z",
      "updatedAt": "2026-11-12T14:05:00.000Z",
      "resolvedAt": null
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1000,
  "totalPages": 50
}
```

### 2.2 Карточка / Details

```http
GET /api/requests/:id
```

Returns the same `Request` plus `description`, `history` (sorted by `createdAt` ascending) and
the wave-1 fields:

| Поле | Тип | Смысл |
| --- | --- | --- |
| `rejectReason` | `string \| null` | код причины отказа, копия последнего `reasonCode` |
| `resumeDate` | `string \| null` | дата возобновления, заданная при `PENDING` |
| `confirmedAt` | `string \| null` | житель подтвердил результат (флаг, статус остаётся `RESOLVED`) |
| `reopenCount` | `number` | сколько раз житель возвращал заявку в работу |

A resident requesting someone else's request gets `403`.

```json
{
  "history": [
    { "id": "h1", "fromStatus": null, "toStatus": "NEW", "comment": null, "reasonCode": null,
      "changedBy": { "fullName": "Иван Петров", "role": "RESIDENT" },
      "createdAt": "2026-11-12T14:05:00.000Z" }
  ]
}
```

`reasonCode` заполняется только у записей об отказе (`DUPLICATE`, `NOT_CITY_SERVICE`,
`INSUFFICIENT_INFO`, `SPAM`, `OTHER`) и показывается в истории как «Причина: …».

### 2.3 Создание / Create (FR-2)

```http
POST /api/requests
Content-Type: multipart/form-data
```

| Поле | Тип | Обязательное | Правило |
| --- | --- | --- | --- |
| `title` | text | да | 5…120 символов |
| `description` | text | да | 10…2000 символов |
| `category` | text | да | одно из значений enum |
| `priority` | text | нет | `LOW` \| `NORMAL` (по умолчанию) \| `HIGH` \| `URGENT` |
| `address` | text | да | 3…200 символов |
| `lat` | text | **да** | −90…90, иначе `400 «Укажите место на карте»` |
| `lng` | text | **да** | −180…180 |
| `photo` | file | нет | `image/jpeg` \| `image/png` \| `image/webp`, ≤ `MAX_UPLOAD_MB` |

`201 Created` → request JSON. Only `RESIDENT` may call it (`403` for the other roles).

### 2.4 Смена статуса / Status change (FR-3, FR-4)

```http
PATCH /api/requests/:id/status
{ "status": "VERIFIED", "comment": "Передано в службу «Дороги»", "assigneeId": "clx..." }
```

| Правило | Ответ при нарушении |
| --- | --- |
| роль не имеет права на действие | `403 { "error": "Роль RESIDENT не может выполнить это действие" }` |
| переход не входит в матрицу | `409 { "error": "Недопустимый переход статуса: NEW → RESOLVED" }` |
| `NEW → VERIFIED` без `assigneeId` | `400 { "error": "Выберите исполнителя службы" }` |
| `→ REJECTED` без `reasonCode` | `400 { "error": "Причина отказа: допустимые значения — DUPLICATE, NOT_CITY_SERVICE, INSUFFICIENT_INFO, SPAM, OTHER" }` |
| `→ REJECTED` с `reasonCode = OTHER` без комментария | `400` |
| неизвестный `reasonCode` | `400` |
| `→ PENDING` без комментария | `400 { "error": "Укажите причину приостановки" }` |
| `→ RESOLVED` без комментария | `400` (что именно сделано) |
| `resumeDate` не дата | `400`, пустая строка → `null` |
| исполнитель закрывает чужую заявку | `403` |

Доступные действия по статусам: `NEW/VERIFIED → REJECTED` (оператор), `VERIFIED → IN_PROGRESS`
(исполнитель), `IN_PROGRESS → PENDING | RESOLVED | VERIFIED` (исполнитель),
`PENDING → IN_PROGRESS | VERIFIED` (исполнитель), `RESOLVED → VERIFIED` (житель-автор).

`200 OK` → request JSON с обновлёнными `status`, `history`, `resolvedAt`, `rejectReason`,
`resumeDate`, `reopenCount`, `confirmedAt`.

### 2.5 Подтверждение и возврат жителя / Confirm and reopen (BL-R1)

```http
POST /api/requests/:id/confirm
POST /api/requests/:id/reopen
{ "comment": "Проблема осталась" }
```

| Правило | Ответ |
| --- | --- |
| роль не `RESIDENT` | `403` |
| заявка не принадлежит жителю | `403 { "error": "Подтвердить может только автор заявки" }` |
| статус не `RESOLVED` | `409 { "error": "Подтвердить можно только выполненную заявку" }` |
| повторный `confirm` | `409` |

`confirm` ставит `confirmedAt` и не меняет статус; `reopen` переводит `RESOLVED → VERIFIED`,
увеличивает `reopenCount`, очищает `resolvedAt` и `confirmedAt` и пишет запись в историю
(комментарий по умолчанию, если тело пустое).

## 3. Пользователи и администратор / Users and admin

### 3.1 Справочники и исполнители

| Метод | Путь | Роль | Назначение |
| --- | --- | --- | --- |
| GET | `/categories` | любая (вход) | активные категории: `{ items: [{ code, name, slaHours }] }` (BL-T1) |
| GET | `/users/executors` | OPERATOR, ADMIN | исполнители с полем `service: { id, code, name }`, чтобы фильтровать по категории |

### 3.2 Админские маршруты (BL-T1)

Все маршруты ниже, кроме `GET /admin/stats`, закрыты `requireRole('ADMIN')`; любой другой роли —
`403`. Ошибки валидации — `400`, ограничения безопасности — `409` (см. таблицу в
[07-roles-and-statuses.md](07-roles-and-statuses.md) §6.1.1).

| Метод | Путь | Тело | Ответ |
| --- | --- | --- | --- |
| GET | `/admin/stats` | — | `{ total, byStatus, byCategory, byService, unassigned, rejected, avgResolutionHours }` |
| GET | `/admin/users?search=&role=&page=&limit=` | — | `{ items: AdminUser[], page, limit, total, totalPages }` |
| POST | `/admin/users` | `{ email, fullName, role, password, phone?, serviceId? }` | `201 AdminUser` |
| PATCH | `/admin/users/:id` | `{ role?, fullName?, phone?, serviceId?, isActive? }` | `200 AdminUser` |
| POST | `/admin/users/:id/reset-password` | `{ password? }` | `200 { user, password }` — пароль показывается один раз |
| GET | `/admin/services` | — | `{ items: Service[] }` (включая отключённые) |
| POST | `/admin/services` | `{ code, name }` | `201 Service` |
| PATCH | `/admin/services/:id` | `{ name?, isActive? }` | `200 Service` |
| GET | `/admin/categories` | — | `{ items: Category[] }` (включая отключённые) |
| POST | `/admin/categories` | `{ code, name, slaHours? }` | `201 Category` |
| PATCH | `/admin/categories/:id` | `{ name?, slaHours?, isActive? }` | `200 Category` |
| PATCH | `/admin/requests/:id/category` | `{ category, assigneeId? }` | `200 Request` |
| GET | `/admin/audit?objectType=&page=&limit=` | — | `{ items: AuditEntry[], page, limit, total, totalPages }` |
| GET | `/admin/export/requests.csv?<те же фильтры, что у списка>` | — | `200 text/csv`, заголовок `X-Total-Count` |

`AdminUser` — это `user` плюс `isActive: boolean`, `serviceId: string | null`,
`service: { id, code, name } | null`, `createdAt`. `AdminUser` и `AuditEntry` не содержат хеша пароля.

Смена роли, службы или блокировка пишут отдельную запись в журнал на каждое изменение:

```json
PATCH /api/admin/users/clx...
{ "isActive": false }

200 { "id": "clx...", "email": "executor3@cityfix.local", "isActive": false, ... }
409 { "error": "Нельзя разжаловать или заблокировать последнего администратора / the last administrator must stay active" }
```

Смена категории заявки (п.3). Категория определяет службу, поэтому в работу требования жёстче:

```json
PATCH /api/admin/requests/clx.../category
{ "category": "LIGHTING", "assigneeId": "clx-executor-lighting" }

400 { "error": "Выберите исполнителя новой службы / choose an executor of the new service" }
400 { "error": "Исполнитель не из службы этой категории / executor belongs to another service" }
400 { "error": "Категория не изменилась / the category is unchanged" }
400 { "error": "Категория отключена / the category is disabled" }
```

Журнал действий (`AuditEntry`) — только чтение, без маршрутов `PATCH`/`DELETE`:

```json
{
  "items": [
    {
      "id": "clx...",
      "action": "USER_BLOCKED",
      "objectType": "USER",
      "objectId": "clx...",
      "summary": "Заблокирован пользователь executor3@cityfix.local",
      "createdAt": "2026-11-16T09:12:00.000Z",
      "actor": { "id": "clx...", "fullName": "Ольга Кузнецова", "role": "ADMIN" }
    }
  ],
  "page": 1, "limit": 50, "total": 7, "totalPages": 1
}
```

### 3.3 Выгрузка CSV (BL-T1 п.6)

`GET /admin/export/requests.csv` принимает те же параметры, что и `GET /requests`, и собирает файл
тем же построителем фильтра — поэтому выгрузка совпадает со списком на экране.

- кодировка UTF-8 с BOM, разделитель `;` — Excel открывает кириллицу без настройки импорта;
- 13 колонок: номер, создана, статус, категория, служба, приоритет, название, адрес, автор,
  исполнитель, выполнена, причина отказа, комментарий;
- максимум 5000 строк за один файл, иначе `400` с просьбой сузить период;
- каждое скачивание пишется в журнал как `REQUESTS_EXPORTED`;
- `X-Total-Count` в заголовке — количество выгруженных строк для сообщения на экране.

## 4. Файлы / Files

Uploaded photos are served read-only from `/uploads/<file>` by the API and proxied by nginx.
The URL is relative, so the same build works on `localhost:8080` and on `:5173` in dev.

## 5. Ошибки / Errors

| Код | Когда | Тело |
| --- | --- | --- |
| `400` | валидация, плохой файл, нет координат | `{ "error": "Укажите место на карте" }` |
| `401` | нет токена / токен истёк | `{ "error": "Требуется авторизация" }` |
| `403` | роль не может действие, чужая заявка, аккаунт заблокирован при входе | `{ "error": "Учётная запись заблокирована" }` |
| `404` | заявка или пользователь не найдены | `{ "error": "Заявка не найдена" }` |
| `409` | переход статуса недопустим, повторное подтверждение, нарушение правил администратора | `{ "error": "Недопустимый переход статуса: ..." }` |
| `413` | файл больше `MAX_UPLOAD_MB` | `{ "error": "Файл больше 5 МБ" }` |
| `500` | непредвиденная ошибка | `{ "error": "Внутренняя ошибка сервера" }` |

Error messages are human-readable and shown as-is by the client (`ErrorBox`), which is what
TC-2, TC-3 and TC-7 expect.

## 6. Пример сессии / Example session

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"resident@cityfix.local","password":"Resident123!"}' | jq -r .token)

curl -s -X POST http://localhost:4000/api/requests \
  -H "Authorization: Bearer $TOKEN" \
  -F "title=Яма на дороге" -F "description=Провал асфальта у дома 15" \
  -F "category=ROADS" -F "address=ул. Ленина, 15" \
  -F "lat=55.7558" -F "lng=37.6173" -F "photo=@pothole.jpg"
```
