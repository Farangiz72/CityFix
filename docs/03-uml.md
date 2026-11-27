# 5. UML

Two diagram types from the presentation: **use cases** (who can do what) and **sequence**
(the order of calls for the two riskiest scenarios). Both are written in Mermaid, so they render
on GitHub and can be re-exported as PNG for the slides.

## 5.1 Диаграмма вариантов использования / Use case diagram

```mermaid
flowchart LR
    R([Житель / Resident])
    O([Оператор / Operator])
    E([Исполнитель / Executor])
    A([Администратор / Admin])

    subgraph CityFix
        UC1[Вход и регистрация<br/>FR-1]
        UC2[Создать заявку с фото и точкой на карте<br/>FR-2]
        UC3[Смотреть свои заявки и историю<br/>FR-5]
        UC4[Проверить и передать в службу<br/>FR-3]
        UC5[Отклонить заявку]
        UC6[Взять в работу / Закрыть заявку<br/>FR-4]
        UC7[Видеть все заявки, фильтры<br/>read-only]
        UC8[Проверить права на сервере<br/>NFR-2]
    end

    R --> UC1
    R --> UC2
    R --> UC3
    O --> UC1
    O --> UC4
    O --> UC5
    O --> UC7
    E --> UC1
    E --> UC6
    A --> UC1
    A --> UC7

    UC2 -.include.-> UC8
    UC4 -.include.-> UC8
    UC6 -.include.-> UC8
```

Notes:

- **UC8 is included by every state-changing use case** — the role is checked on the server, never
  only in the interface. This is the requirement TC-4 verifies.
- The admin has no status-change use case: sees everything, changes nothing (assumption, see
  [08-risks-and-assumptions.md](08-risks-and-assumptions.md)).

## 5.2 Последовательность: создание заявки с фото / Sequence: create a request (FR-2, TC-1…TC-3)

```mermaid
sequenceDiagram
    autonumber
    actor R as Житель
    participant UI as React (форма + карта)
    participant API as Express API
    participant MW as authenticate / requireRole
    participant UP as upload (multer)
    participant S as request.service
    participant DB as SQLite (Prisma)

    R->>UI: выбирает тип, адрес, точку на карте, фото
    UI->>UI: валидация: точка есть? файл JPG/PNG/WEBP?
    alt точки нет
        UI-->>R: ошибка «Укажите место на карте»
    else всё заполнено
        UI->>API: POST /api/requests (multipart)
        API->>MW: проверка JWT и роли RESIDENT
        alt роли нет / токен истёк
            MW-->>UI: 401 / 403
            UI-->>R: сообщение об ошибке входа
        else роль подтверждена
            API->>UP: тип и размер файла
            alt тип не разрешён
                UP-->>UI: 400 «Недопустимый тип файла»
            else файл принят
                API->>S: createRequest(dto, authorId, photoUrl)
                S->>DB: INSERT Request (status = NEW)
                S->>DB: INSERT StatusHistory (null → NEW)
                DB-->>S: заявка
                S-->>API: DTO
                API-->>UI: 201 Created
                UI-->>R: карточка заявки, статус «Новая»
            end
        end
    end
```

## 5.3 Последовательность: смена статуса с историей / Sequence: status change (FR-3, FR-4, TC-4…TC-6)

```mermaid
sequenceDiagram
    autonumber
    actor U as Оператор / Исполнитель
    participant UI as React (карточка заявки)
    participant API as PATCH /api/requests/:id/status
    participant S as request.service
    participant DB as SQLite (Prisma)

    U->>UI: выбирает новый статус и комментарий
    UI->>API: { status, comment, assigneeId? }
    API->>S: changeStatus(id, user, status)
    S->>DB: SELECT заявка + история
    S->>S: роль разрешает переход? (матрица)
    alt перехода нет для этой роли
        S-->>API: HttpError 403 «Роль не может выполнить действие»
        API-->>UI: 403 + текст
        UI-->>U: «Недостаточно прав»
    else переход разрешён
        S->>S: исполнитель — только своя назначенная заявка?
        S->>DB: BEGIN
        S->>DB: UPDATE Request SET status
        S->>DB: INSERT StatusHistory (from → to, кто, когда, комментарий)
        S->>DB: COMMIT
        S-->>API: обновлённая заявка с историей
        API-->>UI: 200 OK
        UI-->>U: новый StatusBadge и запись в истории
    end
```

## 5.4 Состояния заявки / State machine

```mermaid
stateDiagram-v2
    [*] --> NEW: житель создаёт заявку (FR-2)
    NEW --> VERIFIED: оператор передаёт в службу (FR-3)
    NEW --> REJECTED: оператор отклоняет (с причиной)
    VERIFIED --> IN_PROGRESS: исполнитель берёт в работу
    VERIFIED --> REJECTED: оператор отклоняет
    IN_PROGRESS --> PENDING: нужны материалы / согласование (FR-25)
    PENDING --> IN_PROGRESS: исполнитель возобновляет
    IN_PROGRESS --> RESOLVED: исполнитель выполняет (TC-6)
    PENDING --> RESOLVED: исполнитель выполняет
    IN_PROGRESS --> VERIFIED: возврат оператору
    PENDING --> VERIFIED: возврат оператору
    RESOLVED --> VERIFIED: житель вернул в работу (FR-26)
    RESOLVED --> [*]: житель подтвердил результат
    REJECTED --> [*]
```

| Статус / Status | Подпись в интерфейсе | Кто может установить |
| --- | --- | --- |
| `NEW` | Новая / New | система при создании |
| `VERIFIED` | Проверена / Verified | Оператор (и исполнитель при возврате) |
| `IN_PROGRESS` | В процессе / In progress | Исполнитель |
| `PENDING` | Ожидает / Pending | Исполнитель (с комментарием) |
| `RESOLVED` | Выполнена / Completed | Исполнитель |
| `REJECTED` | Отклонена / Rejected | Оператор (с причиной) |

The full permission matrix is in [07-roles-and-statuses.md](07-roles-and-statuses.md).
`Отклонена` is added on top of the presentation's four statuses — the operator notes in the
presentation say the loop has no rejection state (assumption).
