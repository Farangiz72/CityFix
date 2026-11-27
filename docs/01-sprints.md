# 9. Организация работы / Organization of work

> **Headline of the slide:** *Four sprints lead from requirements to protection, each ends with a demo.*

## 9.1 Схема четырёх спринтов / Four-sprint scheme

Four blocks from left to right, an arrow between neighbours, a diamond mark and a demo signature
under every block. The fourth block is highlighted in colour.

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌══════════════┐
│  Спринт 1    │──▶│  Спринт 2    │──▶│  Спринт 3    │──▶║  Спринт 4    ║
│  Анализ      │   │  Основа      │   │  Интерфейс   │   ║  Тестирование║
│  и дизайн    │   │  системы     │   │  и интеграция│   ║  и защита    ║
└──────────────┘   └──────────────┘   └──────────────┘   └══════════════┘
     ◇ демо             ◇ демо             ◇ демо             ◆ демо
```

```
sprint 1 ──▶ sprint 2 ──▶ sprint 3 ──▶ sprint 4   (highlighted)
   ◇ demo       ◇ demo       ◇ demo       ◆ demo
```

**The duration of the sprints is not specified in the presentation, so the blocks are not scaled.**
The blocks are equal on purpose: the slide shows the order of work, not the calendar.

## 9.2 Содержание спринтов / Sprint contents

| Спринт / Sprint | Тема / Theme | Результат / Result | Демо / Demo |
| --- | --- | --- | --- |
| 1 | Анализ и дизайн / Analysis and design | требования, UML, ER-диаграмма, макеты | требования, диаграммы, макеты |
| 2 | Основа системы / The basis of the system | backend, база данных, авторизация | вход по ролям, работающий API |
| 3 | Интерфейс и интеграция / Interface and integration | карта, форма, связка с API | полный путь заявки в интерфейсе |
| 4 | Тестирование и защита / Testing and protection | тест-кейсы, исправления, демонстрация | система и отчёт о тестировании |

## 9.3 Git и инструменты / Git and tools (slide 7)

- **GitHub**, ветки `main` (рабочая версия / working version) и `develop` (разработка / development).
- Каждая задача — в своей ветке `feature/...`. Код попадает в `develop` **только** через
  Pull Request и ревью другого участника. `main` обновляется в конце спринта после демо
  (допущение / assumption).
- Task board с колонками `To Do`, `In Progress`, `Done`.
- Групповой чат и короткий ежедневный созвон / group chat and a short daily call.
- **Docker** для одинакового окружения у всех участников.

### Правила ветвления / Branch rules

```
main      ●────────────●────────────●────────────●        ← обновляется после демо
         ╱            ╱            ╱            ╱
develop ●──●──●──●───●──●──●──●───●──●──●──●───●          ← только через Pull Request
         ╲  ╱ ╲  ╱     ╲  ╱ ╲  ╱     ╲  ╱ ╲  ╱
        feature/…      feature/…      feature/…
```

- Имя ветки: `feature/12-status-history` (номер issue + короткое имя).
- One owner per folder — снижает риск конфликтов: `backend/` — бэкенд, `frontend/` — фронтенд,
  `docs/` — аналитик и QA.
- Ветки короткие: Pull Request каждый день, а не в конце спринта.
- Ревью обязательное: автор PR не может сам его смёржить.

## 9.4 Церемонии Scrum / Scrum ceremonies

| Церемония / Ceremony | Кто ведёт / Led by | Результат / Outcome |
| --- | --- | --- |
| Бэклог / Backlog grooming | руководитель / supervisor | задачи берутся из таблицы FR/NFR (`docs/02-requirements.md`) |
| Планирование спринта / Sprint planning | команда | цель спринта, задачи в `To Do` |
| Ежедневный созвон / Daily call | команда | 10 минут: что сделано, что мешает |
| Демо в конце спринта / Demo | команда | работающий инкремент по ролям |
| Ретроспектива / Retrospective | команда | что улучшить в процессе |

The backlog is fed from the FR/NFR table, so every task in the board can be traced back to a
requirement and forward to a test case (TC-x). That traceability is what makes the test report in
sprint 4 possible.

## 9.5 Кто что делает в каждом спринте / Who does what

Roles below are project roles, not system roles: *Supervisor/Backend*, *Frontend*, *Analyst & QA*.

### Спринт 1 — анализ и дизайн

| Участник | Задачи |
| --- | --- |
| Supervisor & Backend | репозиторий с ветками `main` и `develop`, доска (whiteboard), бэклог, пустой каркас Docker; вместе с аналитиком — ER-диаграмма |
| Frontend | макеты экранов для четырёх ролей, единый стиль, цвета, подписи статусов |
| Analyst & QA | таблица требований FR/NFR, UML (use cases + sequence), ER-диаграмма |

Deliverables in this repository: [02-requirements.md](02-requirements.md),
[03-uml.md](03-uml.md), [04-er.md](04-er.md), [05-layouts.md](05-layouts.md),
[09-api-contract.md](09-api-contract.md), root `docker-compose.yml`.

### Спринт 2 — основа системы

| Участник | Задачи |
| --- | --- |
| Supervisor & Backend | схема БД и начальные данные, регистрация и вход (JWT), `requireRole`, создание и список заявок, смена статуса с историей, загрузка фото |
| Frontend | каркас Vite + React + TypeScript, маршрутизация `ProtectedRoute`, клиент Axios, экраны входа и регистрации |
| Analyst & QA | тест-кейсы по требованиям, проверка API без интерфейса |

Deliverables: `backend/prisma/schema.prisma`, `backend/src/middleware/*`,
`frontend/src/api/*`, `frontend/src/auth/*`.

### Спринт 3 — интерфейс и интеграция

| Участник | Задачи |
| --- | --- |
| Supervisor & Backend | фильтры и пагинация, доработка прав и ошибок API, маршруты администратора |
| Frontend | карта и форма, списки и карточки для всех ролей, `StatusBadge`, состояния загрузки, ошибки и пустой список, адаптивность |
| Analyst & QA | проверка связки клиента с API, первый список найденных ошибок |

Deliverables: `MapPicker`, `ReportCard`, `StatusBadge`, `RequestDetailsPage`, фильтры и
пагинация на сервере (см. [09-api-contract.md](09-api-contract.md)).

### Спринт 4 — тестирование и защита

| Участник | Задачи |
| --- | --- |
| Supervisor & Backend | исправления, merge в `main`, README, запуск одной командой |
| Frontend | правки интерфейса, проверка на телефоне и ноутбуке, скриншоты для защиты |
| Analyst & QA | выполнение TC-1…TC-7 (и добавленных TC-8, TC-9), перепроверка исправлений, отчёт о тестировании |

Deliverables: [06-test-cases.md](06-test-cases.md) with results, `README.md`, this `docs/` set.

## 9.6 Трассировка / Traceability

```
FR/NFR ──▶ задача на доске ──▶ ветка feature/* ──▶ Pull Request ──▶ тест-кейс TC-x ──▶ отчёт
```

| Требование | Задачи спринтов | Тест-кейсы |
| --- | --- | --- |
| FR-1 | 1 (use case), 2 (JWT вход), 8 | TC-7 |
| FR-2 | 2 (создание), 3 (карта и форма) | TC-1, TC-2, TC-3 |
| FR-3 | 2 (смена статуса), 3 (фильтры) | TC-5 |
| FR-4 | 2 (история), 3 (права) | TC-4, TC-6 |
| FR-5 | 2 (история), 3 (карточка), 8 | TC-8 |
| NFR-1 | 3 (пагинация, индексы) | TC-9 |
| NFR-2 | 2 (multer, `requireRole`), 3 (права) | TC-3, TC-4 |
