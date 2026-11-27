/**
 * Начальные данные / Seed data.
 * - шесть пользователей (по одному на роль, второй житель для «чужих» заявок и второй исполнитель
 *   для проверки TC-15 «чужая заявка»);
 * - шесть демонстрационных заявок со всеми статусами и полной историей;
 * - заявки-наполнители для проверки NFR-1 (TC-9), количество задаётся SEED_DEMO_REQUESTS.
 * Скрипт идемпотентен: пользователи обновляются по email, заявки создаются один раз.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import type { Category, RequestStatus } from '../src/domain';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;
const DAY = 24 * 60 * 60 * 1000;

type SeedRole = 'RESIDENT' | 'OPERATOR' | 'EXECUTOR' | 'ADMIN';

interface SeedUser {
  email: string;
  password: string;
  fullName: string;
  role: SeedRole;
  phone: string;
  /** Код службы для исполнителя / service code for an executor (BL-T1). */
  serviceCode?: string;
}

/** Категории-справочник (BL-T1): название и норматив SLA меняются администратором. */
const SEED_CATEGORIES = [
  { code: 'ROADS', name: 'Дороги', slaHours: 72 },
  { code: 'LIGHTING', name: 'Освещение', slaHours: 48 },
  { code: 'WATER', name: 'Вода', slaHours: 24 },
  { code: 'WASTE', name: 'Мусор', slaHours: 48 },
  { code: 'OTHER', name: 'Другое', slaHours: 120 },
];

/** Службы-справочник: код совпадает с категорией, поэтому служба заявки = её категория. */
const SEED_SERVICES = [
  { code: 'ROADS', name: 'Служба «Дороги»' },
  { code: 'LIGHTING', name: 'Служба «Горсвет»' },
  { code: 'WATER', name: 'Служба «Водоканал»' },
  { code: 'WASTE', name: 'Служба «Уборка»' },
  { code: 'OTHER', name: 'Подрядчик «Прочее»' },
];

const SEED_USERS: SeedUser[] = [
  {
    email: 'resident@cityfix.local',
    password: 'Resident123!',
    fullName: 'Иван Петров',
    role: 'RESIDENT',
    phone: '+7 900 111-11-11',
  },
  {
    email: 'resident2@cityfix.local',
    password: 'Resident123!',
    fullName: 'Мария Соколова',
    role: 'RESIDENT',
    phone: '+7 900 222-22-22',
  },
  {
    email: 'operator@cityfix.local',
    password: 'Operator123!',
    fullName: 'Анна Сергеева',
    role: 'OPERATOR',
    phone: '+7 900 333-33-33',
  },
  {
    email: 'executor@cityfix.local',
    password: 'Executor123!',
    fullName: 'Служба «Дороги»',
    role: 'EXECUTOR',
    phone: '+7 900 444-44-44',
    serviceCode: 'ROADS',
  },
  {
    // Второй исполнитель: проверка «чужая заявка» (TC-15) и двух исполнителей на одну заявку
    email: 'executor2@cityfix.local',
    password: 'Executor123!',
    fullName: 'Служба «Горсвет»',
    role: 'EXECUTOR',
    phone: '+7 900 666-66-66',
    serviceCode: 'LIGHTING',
  },
  {
    email: 'executor3@cityfix.local',
    password: 'Executor123!',
    fullName: 'Служба «Водоканал»',
    role: 'EXECUTOR',
    phone: '+7 900 777-77-77',
    serviceCode: 'WATER',
  },
  {
    email: 'executor4@cityfix.local',
    password: 'Executor123!',
    fullName: 'Служба «Уборка»',
    role: 'EXECUTOR',
    phone: '+7 900 888-88-88',
    serviceCode: 'WASTE',
  },
  {
    email: 'executor5@cityfix.local',
    password: 'Executor123!',
    fullName: 'Подрядчик «Прочее»',
    role: 'EXECUTOR',
    phone: '+7 900 999-99-99',
    serviceCode: 'OTHER',
  },
  {
    email: 'admin@cityfix.local',
    password: 'Admin123!',
    fullName: 'Ольга Кузнецова',
    role: 'ADMIN',
    phone: '+7 900 555-55-55',
  },
];

interface DemoRequest {
  title: string;
  description: string;
  category: Category;
  address: string;
  lat: number;
  lng: number;
  status: RequestStatus;
  authorEmail: string;
  assigneeEmail?: string;
  rejectReason?: string;
  resumeDate?: string;
  daysAgo: number;
}

const DEMO_REQUESTS: DemoRequest[] = [
  {
    title: 'Яма на дороге у дома 15',
    description: 'Глубокая яма на проезжей части, машины объезжают по встречной полосе.',
    category: 'ROADS',
    address: 'ул. Ленина, 15',
    lat: 55.7558,
    lng: 37.6173,
    status: 'NEW',
    authorEmail: 'resident@cityfix.local',
    daysAgo: 1,
  },
  {
    title: 'Не горит фонарь во дворе',
    description: 'Фонарь не работает третью неделю, во дворе темно, вечером страшно ходить.',
    category: 'LIGHTING',
    address: 'ул. Мира, 4',
    lat: 55.7601,
    lng: 37.6011,
    status: 'VERIFIED',
    authorEmail: 'resident@cityfix.local',
    assigneeEmail: 'executor2@cityfix.local',
    daysAgo: 3,
  },
  {
    title: 'Течь трубы в подвале',
    description: 'В подвале дома стоит вода, пахнет сыростью, слышно как капает за стеной.',
    category: 'WATER',
    address: 'пр-т Победы, 22',
    lat: 55.7489,
    lng: 37.6332,
    status: 'IN_PROGRESS',
    authorEmail: 'resident@cityfix.local',
    assigneeEmail: 'executor3@cityfix.local',
    daysAgo: 5,
  },
  {
    title: 'Мусор у подъезда не вывозят',
    description: 'Контейнеры переполнены, мусор лежит рядом, появились крысы.',
    category: 'WASTE',
    address: 'ул. Садовая, 8',
    lat: 55.7667,
    lng: 37.6501,
    status: 'RESOLVED',
    authorEmail: 'resident@cityfix.local',
    assigneeEmail: 'executor4@cityfix.local',
    daysAgo: 12,
  },
  {
    title: 'Провал тротуара у школы',
    description: 'Осела плитка, образовался провал глубиной по колено, дети ходят в школу рядом.',
    category: 'ROADS',
    address: 'ул. Школьная, 3',
    lat: 55.7412,
    lng: 37.5899,
    status: 'REJECTED',
    authorEmail: 'resident2@cityfix.local',
    rejectReason: 'NOT_CITY_SERVICE',
    daysAgo: 8,
  },
  {
    title: 'Разбитая остановка на набережной',
    description: 'Стеклянная стенка остановки разбита, осколки лежат на асфальте.',
    category: 'OTHER',
    address: 'набережная Реки, 1',
    lat: 55.7799,
    lng: 37.6402,
    status: 'PENDING',
    authorEmail: 'resident2@cityfix.local',
    assigneeEmail: 'executor5@cityfix.local',
    resumeDate: '2026-12-01',
    daysAgo: 0,
  },
];

const FILLER_TITLES = [
  'Повреждение покрытия',
  'Не работает уличное освещение',
  'Затопление пешеходной дорожки',
  'Переполненный контейнер',
  'Повреждена скамейка',
];
const FILLER_CATEGORIES: Category[] = ['ROADS', 'LIGHTING', 'WATER', 'WASTE', 'OTHER'];
const STATUSES: RequestStatus[] = ['NEW', 'VERIFIED', 'IN_PROGRESS', 'PENDING', 'RESOLVED', 'REJECTED'];

function daysAgoDate(days: number): Date {
  return new Date(Date.now() - days * DAY);
}

/**
 * Справочники служб и категорий (BL-T1). Идемпотентно: обновляем названия и SLA,
 * но не возвращаем отключённые записи в строй.
 */
async function seedDirectories(): Promise<Map<string, string>> {
  const serviceIds = new Map<string, string>();

  for (const category of SEED_CATEGORIES) {
    await prisma.category.upsert({
      where: { code: category.code },
      update: { name: category.name, slaHours: category.slaHours },
      create: category,
    });
  }

  for (const service of SEED_SERVICES) {
    const record = await prisma.service.upsert({
      where: { code: service.code },
      update: { name: service.name },
      create: service,
    });
    serviceIds.set(service.code, record.id);
  }

  console.log(
    `[seed] справочники / directories: категорий ${SEED_CATEGORIES.length}, служб ${serviceIds.size}`,
  );
  return serviceIds;
}

async function seedUsers(serviceIds: Map<string, string>): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const user of SEED_USERS) {
    const passwordHash = await bcrypt.hash(user.password, BCRYPT_ROUNDS);
    const serviceId = user.serviceCode ? (serviceIds.get(user.serviceCode) ?? null) : null;
    const record = await prisma.user.upsert({
      where: { email: user.email },
      update: { fullName: user.fullName, role: user.role, phone: user.phone, serviceId, isActive: true },
      create: {
        email: user.email,
        passwordHash,
        fullName: user.fullName,
        role: user.role,
        phone: user.phone,
        serviceId,
      },
    });
    ids.set(user.email, record.id);
  }

  console.log(`[seed] пользователей / users: ${ids.size}`);
  return ids;
}

/**
 * BL-T1 п.5: на чистой базе журнал пуст, поэтому первой записью отмечаем саму инициализацию
 * справочников — экран «Журнал» сразу показывает пример. Повторный seed ничего не добавляет.
 */
async function seedAudit(ids: Map<string, string>): Promise<void> {
  const actorId = ids.get('admin@cityfix.local');
  const category = await prisma.category.findFirst({ orderBy: { createdAt: 'asc' } });
  const service = await prisma.service.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!actorId || !category || !service) {
    return;
  }

  const existing = await prisma.auditLog.count();
  if (existing > 0) {
    console.log(`[seed] журнал уже заполнен / audit entries present: ${existing}`);
    return;
  }

  await prisma.auditLog.createMany({
    data: [
      {
        actorId,
        action: 'CATEGORY_CREATED',
        objectType: 'CATEGORY',
        objectId: category.id,
        summary: `Начальный справочник категорий: ${SEED_CATEGORIES.map((item) => item.code).join(', ')}`,
        details: JSON.stringify({ codes: SEED_CATEGORIES.map((item) => item.code) }),
      },
      {
        actorId,
        action: 'SERVICE_CREATED',
        objectType: 'SERVICE',
        objectId: service.id,
        summary: `Начальный справочник служб: ${SEED_SERVICES.map((item) => item.code).join(', ')}`,
        details: JSON.stringify({ codes: SEED_SERVICES.map((item) => item.code) }),
      },
    ],
  });
  console.log('[seed] записей журнала / audit entries: 2');
}

interface SeedHistoryRow {
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  comment: string;
  reasonCode?: string;
  changedById: string;
  createdAt: Date;
}

function historyFor(request: DemoRequest, userId: string, authorId: string, operatorId: string): SeedHistoryRow[] {
  const created = daysAgoDate(request.daysAgo);
  const rows: SeedHistoryRow[] = [
    {
      fromStatus: null,
      toStatus: 'NEW',
      comment: 'Заявка создана / request created',
      changedById: authorId,
      createdAt: created,
    },
  ];

  if (request.status === 'NEW') {
    return rows;
  }

  const verified = new Date(created.getTime() + 6 * 60 * 60 * 1000);

  if (request.status === 'REJECTED') {
    rows.push({
      fromStatus: 'NEW',
      toStatus: 'REJECTED',
      comment: 'Не относится к зоне ответственности службы / out of scope',
      reasonCode: request.rejectReason,
      changedById: operatorId,
      createdAt: verified,
    });
    return rows;
  }

  rows.push({
    fromStatus: 'NEW',
    toStatus: 'VERIFIED',
    comment: 'Передано в службу / dispatched to the service',
    changedById: operatorId,
    createdAt: verified,
  });

  if (request.status === 'VERIFIED') {
    return rows;
  }

  const started = new Date(created.getTime() + 2 * DAY);
  rows.push({
    fromStatus: 'VERIFIED',
    toStatus: 'IN_PROGRESS',
    comment: 'Бригада выехала на место / crew on site',
    changedById: userId,
    createdAt: started,
  });

  if (request.status === 'IN_PROGRESS') {
    return rows;
  }

  if (request.status === 'PENDING') {
    rows.push({
      fromStatus: 'IN_PROGRESS',
      toStatus: 'PENDING',
      comment: 'Ждём поставку стекла / waiting for the glass delivery',
      changedById: userId,
      createdAt: new Date(started.getTime() + DAY),
    });
    return rows;
  }

  rows.push({
    fromStatus: 'IN_PROGRESS',
    toStatus: 'RESOLVED',
    comment: 'Работы выполнены / work completed',
    changedById: userId,
    createdAt: new Date(started.getTime() + DAY),
  });

  return rows;
}

async function seedDemoRequests(ids: Map<string, string>): Promise<void> {
  const existing = await prisma.request.count();
  if (existing > 0) {
    console.log(`[seed] заявки уже есть / requests already present: ${existing}`);
    return;
  }

  const operatorId = ids.get('operator@cityfix.local') ?? '';
  // В SQLite нет автоинкремента для не-id поля — сквозные номера выдаём сами.
  let nextNumber =
    ((await prisma.request.aggregate({ _max: { number: true } }))._max.number ?? 0) + 1;

  for (const request of DEMO_REQUESTS) {
    const authorId = ids.get(request.authorEmail);
    if (!authorId) {
      continue;
    }
    const assigneeId = request.assigneeEmail ? ids.get(request.assigneeEmail) : undefined;
    const createdAt = daysAgoDate(request.daysAgo);

    const created = await prisma.request.create({
      data: {
        number: nextNumber++,
        title: request.title,
        description: request.description,
        category: request.category,
        priority: 'NORMAL',
        status: request.status,
        address: request.address,
        lat: request.lat,
        lng: request.lng,
        authorId,
        assigneeId: assigneeId ?? null,
        createdAt,
        updatedAt: createdAt,
        resolvedAt: request.status === 'RESOLVED' ? new Date(createdAt.getTime() + 3 * DAY) : null,
        rejectReason: request.rejectReason ?? null,
        resumeDate: request.resumeDate ? new Date(request.resumeDate) : null,
      },
    });

    const history = historyFor(request, assigneeId ?? '', authorId, operatorId);
    for (const row of history) {
      await prisma.statusHistory.create({
        data: {
          requestId: created.id,
          fromStatus: row.fromStatus,
          toStatus: row.toStatus,
          comment: row.comment,
          reasonCode: row.reasonCode ?? null,
          changedById: row.changedById || authorId,
          createdAt: row.createdAt,
        },
      });
    }
  }

  console.log(`[seed] демонстрационных заявок / demo requests: ${DEMO_REQUESTS.length}`);
}

async function seedFillers(ids: Map<string, string>): Promise<void> {
  const target = Number(process.env.SEED_DEMO_REQUESTS ?? 1000);
  if (!Number.isFinite(target) || target <= 0) {
    return;
  }

  const residents = [...ids.values()].slice(0, 2);
  const authorId = residents[0] ?? '';
  if (!authorId) {
    return;
  }

  // Каждая служба исполняет заявки своей категории — фильтр и статистика по службе осмысленны.
  const executorByCategory = new Map<string, string>();
  for (const user of SEED_USERS) {
    const id = ids.get(user.email);
    if (id && user.serviceCode) {
      executorByCategory.set(user.serviceCode, id);
    }
  }

  const CHUNK = 500;
  // Нумерация продолжается после демо-заявок / numbering continues after the demo requests.
  const baseNumber = (await prisma.request.aggregate({ _max: { number: true } }))._max.number ?? 0;
  let created = 0;

  while (created < target) {
    const batch = Math.min(CHUNK, target - created);
    const data = Array.from({ length: batch }, (_, index) => {
      const offset = created + index;
      const status = STATUSES[offset % STATUSES.length] ?? 'NEW';
      const category = FILLER_CATEGORIES[offset % FILLER_CATEGORIES.length] ?? 'OTHER';
      const createdAt = daysAgoDate((offset % 60) + 1);

      return {
        number: baseNumber + created + index + 1,
        title: `${FILLER_TITLES[offset % FILLER_TITLES.length]} №${offset + 1}`,
        description: 'Заявка-наполнитель для проверки производительности списка (NFR-1, TC-9).',
        category,
        priority: 'NORMAL' as const,
        status,
        address: `Тестовая улица, ${offset + 1}`,
        lat: 55.75 + (offset % 100) / 1000,
        lng: 37.61 + (offset % 100) / 1000,
        authorId: residents[offset % residents.length] ?? authorId,
        assigneeId:
          status === 'VERIFIED' || status === 'IN_PROGRESS' || status === 'PENDING' || status === 'RESOLVED'
            ? (executorByCategory.get(category) ?? null)
            : null,
        createdAt,
        updatedAt: createdAt,
        resolvedAt: status === 'RESOLVED' ? new Date(createdAt.getTime() + DAY) : null,
      };
    });

    await prisma.request.createMany({ data });
    created += batch;
  }

  console.log(`[seed] заявок-наполнителей / filler requests: ${created}`);
}

async function main(): Promise<void> {
  const serviceIds = await seedDirectories();
  const ids = await seedUsers(serviceIds);
  await seedAudit(ids);
  await seedDemoRequests(ids);
  await seedFillers(ids);

  const total = await prisma.request.count();
  console.log(`[seed] всего заявок в БД / requests in database: ${total}`);
}

main()
  .catch((error) => {
    console.error('[seed] ошибка / seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
