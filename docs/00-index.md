# 0. Содержание документации / Documentation index

| Файл / File | Раздел презентации / Slide section | Что внутри / Contents |
| --- | --- | --- |
| [01-sprints.md](01-sprints.md) | Section 9 — Organization of work | четыре спринта, Git и инструменты, церемонии Scrum, кто что делает |
| [02-requirements.md](02-requirements.md) | Section 4 — Требования | таблица FR/NFR, MoSCoW-приоритеты, критерии приёмки |
| [03-uml.md](03-uml.md) | Section 5 — UML | use case diagram, sequence diagrams (создание заявки, смена статуса) |
| [04-er.md](04-er.md) | Section 5 — ER-диаграмма | ER-модель (6 сущностей), словарь данных, индексы |
| [05-layouts.md](05-layouts.md) | Section 6 — Макеты | макеты четырёх ролей, единый стиль, цвета, подписи статусов |
| [06-test-cases.md](06-test-cases.md) | Section 10 — Testing | TC-1…TC-34, четыре вида проверок, прогоны §10.5–10.7 |
| [07-roles-and-statuses.md](07-roles-and-statuses.md) | Section 6 | матрица прав, матрица переходов статусов, правила администратора (§6.1.1) |
| [08-risks-and-assumptions.md](08-risks-and-assumptions.md) | Section 12 | критерии готовности, риски, допущения и открытые вопросы |
| [09-api-contract.md](09-api-contract.md) | Sprint 1 deliverable | контракт REST API, коды ошибок, форматы |
| [10-backlog.md](10-backlog.md) | «Планы на будущее» + задачи 1–6 | бэклог развития: пункты по ролям, волны, новые FR/TC, изменения схемы и API, админ-блок BL-T1, геокодер и токены |

## Сквозной сценарий / End-to-end scenario

```
Житель создаёт заявку с фото и точкой на карте
  └─▶ Оператор проверяет и передаёт в службу        (NEW → VERIFIED)
        └─▶ Исполнитель берёт в работу              (VERIFIED → IN_PROGRESS)
              ├─▶ Исполнитель ставит на паузу и возобновляет (PENDING ⇄ IN_PROGRESS)
              └─▶ Исполнитель выполняет             (IN_PROGRESS → RESOLVED)
                    ├─▶ Житель подтверждает результат (confirmed_at)
                    ├─▶ Житель возвращает в работу    (RESOLVED → VERIFIED)
                    └─▶ Житель видит новый статус и всю историю (FR-5)
```

Every step above is executed through the interface, by three different roles. The fourth role —
the administrator — observes the same data through its own cabinet (BL-T1): users, directories,
all requests with filters and CSV export, statistics and the audit log. That is the demo of
sprint 4 and the main readiness criterion.

## Как читать документы / How to read the docs

Documents are written in English; Russian terms from the presentation (`Новая`, `Проверена`,
`В процессе`, `Ожидает`, `Выполнена`, `Отклонена`, `Житель`, `Оператор`, `Исполнитель`,
`Администратор`) are kept verbatim where they identify a status or a role, because the same words
are shown in the interface. Подписи «В процессе» и «Выполнена» закрепились вместо «В работе» и
«Решена» — это переименование из бэклога (BL-T3).
