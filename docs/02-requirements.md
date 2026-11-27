# 4. Требования / Requirements (FR / NFR)

Seven requirements: five functional (FR-1…FR-5) and two non-functional (NFR-1, NFR-2).
The seven test cases of the presentation cover only five of them — FR-5 and NFR-1 stay
uncovered, which is why TC-8 and TC-9 were added (see [06-test-cases.md](06-test-cases.md)).

## 4.1 Функциональные требования / Functional requirements

| ID | Требование / Requirement | Актор / Actor | Приоритет / MoSCoW | Приёмка / Acceptance criteria |
| --- | --- | --- | --- | --- |
| **FR-1** | Вход в систему по ролям / Role-based sign-in: registration and login, a JWT is issued and the role decides which screens open | все / all | Must | верные данные → токен и своя домашняя страница; неверный пароль → отказ и понятное сообщение |
| **FR-2** | Создание заявки с фото и точкой на карте / Create a request with a photo and a map point (тип, адрес, описание, координаты, файл) | Житель | Must | заявка сохранена со статусом `Новая`, фото доступно; без точки на карте — отказ; неверный тип файла — отказ |
| **FR-3** | Передача заявки в службу / Dispatch: оператор проверяет заявку и передаёт её исполнителю | Оператор | Must | заявка становится `Проверена` и видна исполнителю службы |
| **FR-4** | Смена статуса по ролям с историей / Role-restricted status change with history | Оператор, Исполнитель | Must | разрешённый переход выполняется и пишется в историю; запрещённый — `403` |
| **FR-5** | История заявки видна жителю / The resident sees the new status and the whole history in «Мои заявки» | Житель | Should | после смены статуса житель видит новый статус, автора и время каждого шага |

## 4.2 Нефункциональные требования / Non-functional requirements

| ID | Требование / Requirement | Метрика / Metric | Приоритет | Приёмка |
| --- | --- | --- | --- | --- |
| **NFR-1** | Производительность списка / List performance on a large data set | API response ≤ **2 s** for 1000 records | Should | `GET /api/requests?page=1&limit=20` при 1000 заявках отвечает быстрее 2 секунд |
| **NFR-2** | Безопасность: права и файлы / Security: rights and files | 4 роли, серверная проверка; только JPG/PNG/WEBP до `MAX_UPLOAD_MB` | Must | чужой/запрещённый статус → `403`; `.exe`/`.pdf` → `400` с понятным текстом; размер сверх лимита → `400` |

## 4.3 Приоритеты MoSCoW / MoSCoW priorities

| Приоритет | Что входит |
| --- | --- |
| **Must** | сквозной сценарий «создание → `Выполнена`»: FR-1, FR-2, FR-3, FR-4, NFR-2 |
| **Should** | история для жителя (FR-5), производительность списка (NFR-1) |
| **Could** | фильтры и поиск, пагинация сверх требования, статистика для администратора, статус `Отклонена` |
| **Won't (сейчас)** | мобильное приложение, Telegram-уведомления, аналитика по службам |

If time runs short the order is: end-to-end scenario from creation to `Выполнена` first, FR-5 last.
This is the first risk in [08-risks-and-assumptions.md](08-risks-and-assumptions.md).

Всё, что вынесено за рамки семи требований (подтверждение жителем, оценки, дубли, публичная карта,
админ-управление, отказ с причинами, статусы исполнителя, лендинг, адрес с подсказками через прокси
геокодера, дизайн-токены), собрано в [10-backlog.md](10-backlog.md) с приоритетами и новыми
требованиями FR-6…FR-29, NFR-3…NFR-6, тест-кейсами TC-10…TC-34. **Волна 1 бэклога уже в коде:**
токены, статусы «В процессе / Ожидает / Выполнена», возврат в работу и подтверждение жителем,
отказ с причиной, приоритет «Срочный» — прогон в [06-test-cases.md](06-test-cases.md) §10.6.

## 4.4 Дополнительно к требованиям / Beyond the seven requirements

These features exist in the presentation and in the code, but are not counted as separate
requirements — they support FR-1…FR-5 and NFR-1:

- фильтры по статусу, категории и поиск по адресу/описанию (server-side, with pagination);
- список исполнителей службы для назначения (FR-3);
- маршруты администратора: просмотр всех заявок и сводка (read-only, см.
  [07-roles-and-statuses.md](07-roles-and-statuses.md));
- публичный `GET /api/health` для docker healthcheck.

## 4.5 Соответствие требованиям и тестам / Requirement ↔ test matrix

| Требование | Тест-кейсы | Покрытие |
| --- | --- | --- |
| FR-1 | TC-7 | ✔ |
| FR-2 | TC-1, TC-2, TC-3 | ✔ |
| FR-3 | TC-5 | ✔ |
| FR-4 | TC-4, TC-6 | ✔ |
| FR-5 | TC-8 (добавлен / added) | ✔ |
| NFR-1 | TC-9 (добавлен / added) | ✔ |
| NFR-2 | TC-3, TC-4 | ✔ |

Every requirement has at least one test case — that is the rule stated in the presentation and the
entry condition for the defence.
