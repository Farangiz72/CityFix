# CityFix — приём и обработка городских заявок

**CityFix** is a training project: residents report city problems (roads, lighting, water, waste),
the operator dispatches them to a service, the executor closes them, and every status change keeps
a full history. Four roles, one end-to-end scenario:
**Новая → Проверена → В процессе → Выполнена** (с паузой «Ожидает» и отказом «Отклонена»).

The repository contains the working system, not only slides: the Docker stack below starts from
scratch on a clean machine with one command.

---

## 1. Быстрый старт / Quick start

```bash
# 1. Скопировать шаблон окружения / copy the environment template
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env

# 2. Задать JWT_SECRET (не короче 32 символов) / set JWT_SECRET (32+ characters)
#    Пароль БД не нужен: база — файл SQLite в volume / no DB password: SQLite file in a volume

# 3. Поднять систему / start the stack
docker compose up --build

# 4. Открыть в браузере / open in a browser
#    http://localhost:8080
```

`api` creates its SQLite file in the `db_data` volume, applies the schema, seeds the reference data
and only then starts listening; `web` waits for that healthcheck, serves the built Vite client and
proxies `/api` and `/uploads` to `api`. No database server is started anywhere.

**Reset everything** (database + uploaded photos):

```bash
docker compose down -v
```

### Тестовые учётные записи / Test logins (created by the seed)

| Роль / Role | Логин / Login | Пароль / Password |
| --- | --- | --- |
| Житель / Resident | `resident@cityfix.local` | `Resident123!` |
| Житель 2 / Resident 2 | `resident2@cityfix.local` | `Resident123!` |
| Оператор / Operator | `operator@cityfix.local` | `Operator123!` |
| Исполнитель «Дороги» / Executor | `executor@cityfix.local` | `Executor123!` |
| Исполнитель «Горсвет» / Executor 2 | `executor2@cityfix.local` | `Executor123!` |
| Исполнитель «Водоканал» / Executor 3 | `executor3@cityfix.local` | `Executor123!` |
| Исполнитель «Уборка» / Executor 4 | `executor4@cityfix.local` | `Executor123!` |
| Подрядчик «Прочее» / Executor 5 | `executor5@cityfix.local` | `Executor123!` |
| Администратор / Admin | `admin@cityfix.local` | `Admin123!` |

`resident2` exists on purpose: it is the account for the "other people's requests" check
(TC-4 and the access-rights pass). There is one executor per service (`ROADS`, `LIGHTING`,
`WATER`, `CLEANING`, `OTHER`, linked through `users.service_id`): `executor2` is needed to check
that only the assigned executor can change a request (TC-15) and that the operator can send a
request to another service (TC-5), and the rest make the statistics and the service filter show
all five services.

---

## 2. Стек / Stack

| Слой / Layer | Технологии / Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, React Router, Axios, Leaflet |
| Backend | Node.js 20, Express, TypeScript, Prisma ORM |
| БД / Database | SQLite — файл внутри проекта (`backend/data/cityfix.db`), доступ через Prisma |
| Авторизация / Auth | JWT (access token), bcrypt password hashes, server-side `requireRole` |
| Файлы / Files | `multer`, disk storage in a Docker volume, type and size validation |
| Инфраструктура / Infra | Docker, docker compose (api + web), nginx |

The slides do not name a stack; Node.js + Express + TypeScript + SQLite + disk storage is the
accepted assumption (see [docs/08-risks-and-assumptions.md](docs/08-risks-and-assumptions.md)).
SQLite keeps the “one command on a clean machine” promise honest: no DB server to install, and the
schema moves to PostgreSQL by changing one line in `prisma/schema.prisma`.
If the subject requires another stack, the data schema and the API contract stay the same.

---

## 3. Структура репозитория / Repository layout

```
.
├── docker-compose.yml          # api + web, volumes: db_data (SQLite), uploads
├── .env.example                # JWT_SECRET, MAX_UPLOAD_MB, SEED_*
├── README.md
├── docs/                       # требования, UML, ER, макеты, тест-кейсы, API
│   ├── 00-index.md
│   ├── 01-sprints.md           # Section 9  — организация работы
│   ├── 02-requirements.md      # FR/NFR таблица (Требования)
│   ├── 03-uml.md               # use case + sequence diagrams
│   ├── 04-er.md                # ER-диаграмма
│   ├── 05-layouts.md           # макеты экранов для четырёх ролей
│   ├── 06-test-cases.md        # Section 10 — тестирование, TC-1...TC-34
│   ├── 07-roles-and-statuses.md# матрица прав и переходов статусов
│   ├── 08-risks-and-assumptions.md # Section 12 — готовность, риски, допущения
│   ├── 09-api-contract.md      # контракт API (фиксируется в спринте 1)
│   └── 10-backlog.md           # бэклог: волны, FR-6…FR-29, TC-10…TC-34, геокодер
├── backend/
│   ├── Dockerfile
│   ├── data/                   # cityfix.db — локальная БД SQLite (в .gitignore)
│   ├── uploads/                # фото заявок при локальном запуске (в .gitignore)
│   ├── prisma/                 # schema.prisma + seed.ts
│   ├── scripts/                # smoke-wave1.ps1, smoke-admin.ps1 — прогоны TC-1…TC-34
│   └── src/
│       ├── domain.ts           # роли, статусы, матрица переходов, коды справочников
│       ├── routes/             # auth, requests, users, admin (BL-T1)
│       ├── controllers/
│       ├── services/           # бизнес-правила: переходы статусов, права
│       ├── repositories/       # доступ к данным (Prisma)
│       ├── middleware/         # authenticate, requireRole, upload, errorHandler
│       └── utils/
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
│       ├── api/                # Axios client + типы контракта
│       ├── auth/               # AuthContext
│       ├── components/         # StatusBadge, ReportCard, MapPicker, ProtectedRoute, AdminTabs
│       ├── pages/              # resident, operator, executor, admin, shared, auth
│       └── styles/
└── uploads/, db_data           # docker volumes: фото и файл БД (в git не попадают)
```

---

## 4. Роли и статусы / Roles and statuses

| Роль | Что делает | What it does |
| --- | --- | --- |
| Житель / Resident (`RESIDENT`) | создаёт заявку с фото и точкой на карте, видит только свои и всю историю | creates a request with a photo and a map point, sees only own requests plus the full history |
| Оператор / Operator (`OPERATOR`) | принимает заявку, передаёт в службу или отклоняет | verifies a request, dispatches it to a service or rejects it |
| Исполнитель / Executor (`EXECUTOR`) | берёт назначенные заявки в работу и закрывает | takes assigned requests in work and closes them |
| Администратор / Admin (`ADMIN`) | видит всё, ведёт пользователей, справочники, журнал и статистику, переназначает категорию заявки; статусы не меняет | sees everything, manages users, directories, the audit log and statistics, reassigns a request category; does not change statuses |

Statuses and allowed transitions are defined once, on the server ([backend/src/domain.ts](backend/src/domain.ts))
and mirrored in [docs/07-roles-and-statuses.md](docs/07-roles-and-statuses.md):

```
NEW ──▶ VERIFIED ──▶ IN_PROGRESS ──▶ RESOLVED
 └────▶ REJECTED        (any of NEW/VERIFIED may be rejected by the operator)
```

Every transition writes a `StatusHistory` row (who, when, from → to, comment), which is exactly
what TC-6 and TC-8 check.

---

## 5. Административная панель / Admin cabinet (BL-T1)

The administrator gets its own section of the interface; every route below is mounted under
`requireRole('ADMIN')` on the server as well, so a hidden link is never the only protection.

| Раздел / Screen | Маршрут / Route | Что делает / What it does |
| --- | --- | --- |
| Обзор / Overview | `/admin` | сводка, быстрые ссылки, статистика |
| Заявки / Requests | `/admin/requests` | все заявки с фильтрами по статусу, категории, службе-исполнителю и датам; переназначение категории; выгрузка CSV |
| Пользователи / Users | `/admin/users` | поиск, фильтр по роли, создание оператора/исполнителя/админа, смена роли и службы, блокировка, сброс пароля |
| Справочники / Directories | `/admin/directories` | создание и правка служб и категорий, включение/отключение (`is_active`) |
| Журнал / Audit | `/admin/audit` | кто, когда и что менял: роли, блокировки, справочники, переназначение категории, выгрузки |

Правила, которые проверяются на сервере (TC-23…TC-27):

- жители регистрируются сами, новых жителей админ не создаёт — только `OPERATOR`, `EXECUTOR`, `ADMIN`;
- исполнитель без службы создать нельзя: `service_id` выбирается в форме и обязателен для роли `EXECUTOR`;
- заблокированный пользователь (`is_active = false`) получает `403` на входе, а выданный ранее токен — `401`;
- нельзя заблокировать себя и нельзя снять роль с последнего администратора (`409`);
- справочники не удаляются физически: отключённая категория исчезает из формы жителя и из фильтров, но старые заявки открываются с прежней категорией;
- смена категории заявки, которая уже в работе, требует выбрать исполнителя новой службы (иначе `400`);
- журнал аудита — только чтение: маршрутов `PATCH`/`DELETE` для него нет (TC-34).

CSV-выгрузка идёт тем же фильтром, что и список на экране, в UTF-8 с BOM и разделителем `;`
(Excel открывает без настроек), до 5000 строк, с записью о выгрузке в журнале.

---

## 6. Локальная разработка / Local development

Backend:

```bash
cd backend
npm install
# .env (см. backend/.env.example):
# DATABASE_URL=file:C:/absolute/path/to/backend/data/cityfix.db  — абсолютный путь обязателен
# Внешний сервер БД не нужен / no external database server is required
npx prisma db push        # создаёт backend/data/cityfix.db
npm run seed              # тестовые логины + 1000 демо-заявок
npm run dev               # http://localhost:4000
```

Frontend:

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173, /api proxied to :4000
```

Useful scripts: `npm run typecheck` and `npm run build` (backend and frontend). Both waves are
re-checkable end to end (API must be running on `:4000`, DB seeded):

```powershell
cd backend
powershell -ExecutionPolicy Bypass -File scripts/smoke-wave1.ps1   # TC-1…TC-15, BL-R1 — 48 проверок
powershell -ExecutionPolicy Bypass -File scripts/smoke-admin.ps1   # TC-23…TC-27, TC-34 — 74 проверки
```

Both scripts only touch their own temporary users and requests with `number > 100`, so the six
demo requests stay intact for the presentation.

---

## 7. Проверка перед защитой / Readiness checklist

- [x] Локальный запуск проверен: `prisma db push` → `seed` → API → web (`/api/health` отвечает `200`)
- [ ] `docker compose up --build` — проверить на машине с Docker (в среде разработки Docker не установлен)
- [x] The full path "Новая → Проверена → В процессе → Выполнена" passes through the UI under three roles
- [x] Map picker, form and photo upload work; the interface is usable on a phone
- [x] Rights of the four roles are enforced on the server (TC-4 returns 403)
- [x] Админ-блок (BL-T1) проверен скриптом: TC-23…TC-27 и TC-34 — `pass=74 fail=0`,
      волна 1 после новых справочников — `pass=48 fail=0` (см. [06-test-cases.md](docs/06-test-cases.md) §10.6–10.7)
- [x] `docs/` holds requirements, UML, ER diagram, mockups and test cases
- [ ] Slides compare with the real project, names instead of `[Фамилия Имя]`, group and teacher added

Test cases live in [docs/06-test-cases.md](docs/06-test-cases.md); the API contract is in
[docs/09-api-contract.md](docs/09-api-contract.md).
