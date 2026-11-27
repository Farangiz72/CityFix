import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HOME_BY_ROLE } from '../../api/labels';
import { fetchPublicStats, type PublicStats } from '../../api/public';
import { useAuth } from '../../auth/AuthContext';
import heroImage from '../../assets/images/hero-city.svg';
import otherImage from '../../assets/images/category-other.svg';
import lightingImage from '../../assets/images/category-lighting.svg';
import roadsImage from '../../assets/images/category-roads.svg';
import wasteImage from '../../assets/images/category-waste.svg';

/**
 * BL-T4 / FR-26: главная страница до входа.
 *
 * Маршрут `/` открыт всем. Гость видит «Войти» и «Зарегистрироваться», вошедший — «Перейти в кабинет».
 * «Сообщить о проблеме» ведёт на `/login` с запомненной целью `/my/new`: после входа житель попадает
 * сразу в форму заявки, а не в список.
 */

const NUMBERS = new Intl.NumberFormat('ru-RU');

type IconName =
  | 'pen'
  | 'check'
  | 'send'
  | 'done'
  | 'bell'
  | 'status'
  | 'pin'
  | 'photo'
  | 'history';

const ICONS: Record<IconName, JSX.Element> = {
  pen: <path d="M4 20l4-1 9.5-9.5a2.5 2.5 0 0 0-3.5-3.5L4.5 15.5 4 20z" />,
  check: <path d="M4 12.5l5 5L20 6.5" />,
  send: <path d="M4 12l16-7-6.5 16-2.5-6.5L4 12z" />,
  done: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.2l2.6 2.6 4.6-4.8" />
    </>
  ),
  bell: (
    <>
      <path d="M12 4a5 5 0 0 0-5 5v3.6L5 16h14l-2-3.4V9a5 5 0 0 0-5-5z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>
  ),
  status: <path d="M4 19V11M9.5 19V5M15 19v-6M20.5 19V8" />,
  pin: (
    <>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </>
  ),
  photo: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M4 16.5l4.5-4.5 3.5 3.5 3-3 4.5 4.5" />
      <circle cx="8.5" cy="9" r="1.2" />
    </>
  ),
  history: (
    <>
      <path d="M12 8v4.5l3 1.8" />
      <path d="M3.6 12a8.5 8.5 0 1 0 2.7-6.2" />
      <path d="M3 4.5V9h4.5" />
    </>
  ),
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="lp-icon"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}

const STEPS: Array<{ icon: IconName; title: string; text: string }> = [
  {
    icon: 'pen',
    title: 'Создана',
    text: 'Житель описывает проблему, ставит точку на карте и прикладывает фото.',
  },
  {
    icon: 'check',
    title: 'Проверена',
    text: 'Оператор читает заявку, уточняет адрес и решает, в какую службу её передать.',
  },
  {
    icon: 'send',
    title: 'Передана в службу',
    text: 'Заявка попадает к исполнителю нужной службы — он видит её в своих задачах.',
  },
  {
    icon: 'done',
    title: 'Выполнена',
    text: 'Исполнитель закрывает работу и пишет, что сделано. Фото и комментарий остаются в карточке.',
  },
  {
    icon: 'bell',
    title: 'Уведомление',
    text: 'Житель видит новый статус и всю историю шагов — от «Новая» до «Выполнена».',
  },
];

const CATEGORIES = [
  {
    title: 'Дороги',
    text: 'Ямы, провалы, разбитый асфальт, бордюры.',
    image: roadsImage,
    alt: 'Иллюстрация: яма на дороге, трещины и дорожный конус',
  },
  {
    title: 'Освещение',
    text: 'Не горит фонарь, разбитый плафон, тёмный двор.',
    image: lightingImage,
    alt: 'Иллюстрация: вечерняя улица, горящий и потухший фонари',
  },
  {
    title: 'Мусор',
    text: 'Переполненные контейнеры, навалы у дома, свалки.',
    image: wasteImage,
    alt: 'Иллюстрация: контейнеры для мусора и пакеты рядом',
  },
  {
    title: 'Другое',
    text: 'Всё, что не попало в три категории выше.',
    image: otherImage,
    alt: 'Иллюстрация: карта с большой меткой и вопросительным знаком',
  },
];

const ADVANTAGES: Array<{ icon: IconName; title: string; text: string }> = [
  {
    icon: 'status',
    title: 'Статус виден всегда',
    text: 'Не нужно звонить и спрашивать: карточка показывает, на каком шаге заявка сейчас.',
  },
  {
    icon: 'pin',
    title: 'Точка на карте',
    text: 'Место выбирается кликом по карте и подписывается адресом — служба находит его сразу.',
  },
  {
    icon: 'photo',
    title: 'Фото проблемы',
    text: 'Одно фото объясняет больше, чем абзац текста. Форматы JPG, PNG и WEBP до 5 МБ.',
  },
  {
    icon: 'history',
    title: 'История изменений',
    text: 'Каждый переход статуса сохраняется с автором, временем и комментарием — ничего не теряется.',
  },
];

const ROLES = [
  {
    title: 'Жителю',
    text: 'Создать заявку за минуту и следить за её судьбой. Видны только свои заявки.',
  },
  {
    title: 'Оператору',
    text: 'Очередь новых заявок, проверка, передача в службу или отказ с причиной из списка.',
  },
  {
    title: 'Исполнителю',
    text: 'Свои задачи по службе: взять в работу, поставить на паузу, закрыть с комментарием.',
  },
  {
    title: 'Администратору',
    text: 'Пользователи и роли, справочники служб и категорий, статистика и журнал действий.',
  },
];

const FAQ = [
  {
    question: 'Кто может отправить заявку?',
    answer:
      'Любой житель после регистрации: нужны только email, имя и пароль. Сотрудников — операторов и исполнителей — создаёт администратор, сами они не регистрируются.',
  },
  {
    question: 'Почему нужна точка на карте?',
    answer:
      'По координатам служба находит место без звонков и уточнений. Поэтому форма не отправится, пока вы не поставите метку — на сервере это тоже проверяется.',
  },
  {
    question: 'Что будет с заявкой после отправки?',
    answer:
      'Она попадает в очередь оператора со статусом «Новая». Оператор проверит её и передаст исполнителю службы — статус станет «Проверена», а затем «В процессе».',
  },
  {
    question: 'Что, если такую проблему уже сообщили?',
    answer:
      'Оператор отклонит заявку с причиной «Дубликат». Причина и комментарий остаются в карточке, так что видно, почему заявка закрыта.',
  },
  {
    question: 'Работу сделали плохо. Что делать?',
    answer:
      'В выполненной заявке есть кнопка «Проблема осталась»: она возвращает заявку в работу, а счётчик возвратов помогает видеть такие случаи.',
  },
  {
    question: 'Кто видит мои данные?',
    answer:
      'Заявку видят автор, назначенный исполнитель, оператор и администратор. Публичная статистика на этой странице — только обезличенные счётчики.',
  },
];

export function LandingPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPublicStats()
      .then((loaded) => {
        if (!cancelled) setStats(loaded);
      })
      .catch(() => {
        // Счётчики — необязательный блок: без API страница остаётся читаемой.
        if (!cancelled) setStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cabinet = user ? HOME_BY_ROLE[user.role] : '/login';
  const reportPath = user ? (user.role === 'RESIDENT' ? '/my/new' : cabinet) : '/login';
  // Гость после входа попадает сразу в форму заявки (BL-T4).
  const reportState = user ? undefined : { from: '/my/new' };

  return (
    <div className="lp">
      <header className="lp-header">
        <a className="lp-brand" href="#top">
          City<span>Fix</span>
        </a>
        <nav className="lp-nav" aria-label="Разделы страницы">
          <a href="#how">Как это работает</a>
          <a href="#categories">Категории</a>
          <a href="#faq">Вопросы</a>
        </nav>
        <div className="lp-header__actions">
          {user ? (
            <Link className="button button--primary" to={cabinet}>
              Перейти в кабинет
            </Link>
          ) : (
            <>
              <Link className="button button--secondary" to="/login">
                Войти
              </Link>
              <Link className="button button--primary" to="/register">
                Регистрация
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="lp-main" id="top">
        {/* 1. Первый экран */}
        <section className="lp-hero">
          <div className="lp-hero__text">
            <p className="lp-eyebrow">Городские заявки без звонков и бумажек</p>
            <h1 className="lp-hero__title">
              Заметили проблему в городе? Сообщите <span>за минуту</span>
            </h1>
            <p className="lp-hero__lead">
              Яма на дороге, не горит фонарь, мусор у подъезда — отметьте место на карте, приложите
              фото и следите за статусом: оператор передаст заявку в службу, исполнитель её закроет,
              а вы увидите каждый шаг.
            </p>
            <div className="lp-hero__actions">
              <Link className="button button--primary" to={reportPath} state={reportState}>
                Сообщить о проблеме
              </Link>
              {user ? (
                <Link className="button button--secondary" to={cabinet}>
                  Перейти в кабинет
                </Link>
              ) : (
                <Link className="button button--secondary" to="/login">
                  Войти
                </Link>
              )}
            </div>
            <p className="lp-hero__note">
              Регистрация — полминуты · нужны только email и пароль
            </p>
          </div>

          <div className="lp-hero__art">
            <img
              src={heroImage}
              width={640}
              height={470}
              alt="Иллюстрация: городская улица с ямой на дороге, уличным фонарём и телефоном с картой"
            />
          </div>
        </section>

        {/* 2. Как это работает */}
        <section className="lp-section" id="how">
          <header className="lp-section__head">
            <h2>Как это работает</h2>
            <p>Пять шагов от «заметил» до «исправили» — каждый виден в карточке заявки.</p>
          </header>

          <ol className="lp-steps">
            {STEPS.map((step, index) => (
              <li className="lp-step" key={step.title}>
                <span className="lp-step__number">{index + 1}</span>
                <span className="lp-step__icon">
                  <Icon name={step.icon} />
                </span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* 3. Категории */}
        <section className="lp-section" id="categories">
          <header className="lp-section__head">
            <h2>Категории проблем</h2>
            <p>Четыре категории совпадают со справочником города — от него зависит, какая служба получит заявку.</p>
          </header>

          <div className="lp-categories">
            {CATEGORIES.map((category) => (
              <article className="lp-category" key={category.title}>
                <img
                  src={category.image}
                  width={400}
                  height={260}
                  alt={category.alt}
                  loading="lazy"
                  decoding="async"
                />
                <div className="lp-category__body">
                  <h3>{category.title}</h3>
                  <p>{category.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* 4. Преимущества */}
        <section className="lp-section lp-section--alt" id="advantages">
          <header className="lp-section__head">
            <h2>Почему это удобнее звонка</h2>
            <p>Заявка не теряется и не зависит от того, кто сегодня снимает трубку.</p>
          </header>

          <div className="lp-features">
            {ADVANTAGES.map((item) => (
              <article className="lp-feature" key={item.title}>
                <span className="lp-feature__icon">
                  <Icon name={item.icon} />
                </span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 5. Для кого */}
        <section className="lp-section" id="roles">
          <header className="lp-section__head">
            <h2>Кому подходит</h2>
            <p>Один сценарий — четыре роли с разными правами.</p>
          </header>

          <div className="lp-roles">
            {ROLES.map((role) => (
              <article className="lp-role" key={role.title}>
                <h3>{role.title}</h3>
                <p>{role.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 6. Счётчики (публичные, без персональных данных) */}
        {stats ? (
          <section className="lp-section lp-counters" id="stats">
            <header className="lp-section__head">
              <h2>Город в цифрах</h2>
              <p>Обезличенные счётчики: ни адресов, ни имён, ни фото.</p>
            </header>

            <dl className="lp-counters__grid">
              <div>
                <dt>Заявок в системе</dt>
                <dd>{NUMBERS.format(stats.total)}</dd>
              </div>
              <div>
                <dt>Выполнено</dt>
                <dd>{NUMBERS.format(stats.resolved)}</dd>
              </div>
              <div>
                <dt>В работе</dt>
                <dd>{NUMBERS.format(stats.inProgress)}</dd>
              </div>
              <div>
                <dt>Средний срок</dt>
                <dd>
                  {stats.avgResolutionDays === null ? '—' : NUMBERS.format(stats.avgResolutionDays)}
                  <small> дн.</small>
                </dd>
              </div>
            </dl>

            <p className="lp-counters__note">
              Среднее время от «Новая» до «Выполнена» · обновлено{' '}
              {new Date(stats.updatedAt).toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </section>
        ) : null}

        {/* 7. Вопросы */}
        <section className="lp-section" id="faq">
          <header className="lp-section__head">
            <h2>Частые вопросы</h2>
            <p>Коротко о том, что чаще всего спрашивают перед первой заявкой.</p>
          </header>

          <div className="lp-faq">
            {FAQ.map((item) => (
              <details className="lp-faq__item" key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* 8. Призыв и подвал */}
        <section className="lp-cta">
          <h2>Первая заявка занимает меньше минуты</h2>
          <p>Начните с того, что раздражает каждый день: яма во дворе или тёмный переход.</p>
          <Link className="button button--primary" to={reportPath} state={reportState}>
            Сообщить о проблеме
          </Link>
        </section>
      </main>

      <footer className="lp-footer" id="contacts">
        <div className="lp-footer__brand">
          <p className="lp-brand">
            City<span>Fix</span>
          </p>
          <p>
            Учебный проект: приём городских заявок от жителей, работа оператора, службы и
            администратора. Сделан как демонстрация полного цикла — от формы до журнала действий.
          </p>
        </div>

        <div className="lp-footer__col">
          <h3>Контакты</h3>
          <ul>
            <li>
              <a href="mailto:cityfix@example.edu">cityfix@example.edu</a>
            </li>
            <li>
              <a href="tel:+70000000000">+7 (000) 000-00-00</a>
            </li>
            <li>г. Город, ул. Учебная, 1</li>
          </ul>
        </div>

        <div className="lp-footer__col">
          <h3>Разделы</h3>
          <ul>
            <li>
              <a href="#how">Как это работает</a>
            </li>
            <li>
              <a href="#categories">Категории</a>
            </li>
            <li>
              <a href="#faq">Вопросы</a>
            </li>
            <li>
              <Link to="/login">Вход</Link>
            </li>
            <li>
              <Link to="/register">Регистрация</Link>
            </li>
          </ul>
        </div>
      </footer>

      <div className="lp-legal">
        <span>© 2026 CityFix · учебный проект</span>
        <span>
          Иллюстрации — собственные SVG, лицензия проекта (docs/11-media-licenses.md)
        </span>
      </div>
    </div>
  );
}
