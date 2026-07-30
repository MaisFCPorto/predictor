import { Hono } from 'hono';

type Env = {
  DB: D1Database;
  ADMIN_KEY: string;
  LOCK_MINUTES_BEFORE?: string;
};

type FixtureSummary = {
  id: string;
  kickoff_at: string;
  home_team_name: string;
  away_team_name: string;
};

type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const LISBON_TIME_ZONE = 'Europe/Lisbon';
const SEASON_START_LOCAL: LocalParts = {
  year: 2026,
  month: 7,
  day: 28,
  hour: 0,
  minute: 0,
  second: 0,
};
const lisbonFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: LISBON_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export const adminDashboard = new Hono<{ Bindings: Env }>();

adminDashboard.use('*', async (c, next) => {
  const need = c.env.ADMIN_KEY;
  if (!need) {
    await next();
    return;
  }

  const got = c.req.header('x-admin-key');
  if (!got || got !== need) {
    return c.json({ error: 'forbidden' }, 403);
  }

  await next();
});

function getLisbonParts(date: Date): LocalParts {
  const parts = lisbonFormatter.formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function localDateTimeToUtc(parts: LocalParts): Date {
  const desiredAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  let guess = desiredAsUtc;

  // Ajusta a estimativa até as partes em Europe/Lisbon coincidirem.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = getLisbonParts(new Date(guess));
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    const difference = desiredAsUtc - actualAsUtc;
    guess += difference;
    if (difference === 0) break;
  }

  return new Date(guess);
}

function shiftLocalDate(parts: LocalParts, days: number): LocalParts {
  const shifted = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + days),
  );

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function startOfLocalDay(parts: LocalParts): LocalParts {
  return { ...parts, hour: 0, minute: 0, second: 0 };
}

function toSqlUtc(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function parseDbDate(value: string): Date {
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  return new Date(hasTimezone ? normalized : `${normalized}Z`);
}

function safeRate(predictions: number, registeredUsers: number): number {
  if (registeredUsers <= 0) return 0;
  return (predictions / registeredUsers) * 100;
}

async function countUsersBetween(
  db: D1Database,
  start: Date,
  end: Date,
): Promise<number> {
  const row = await db
    .prepare(
      `
      SELECT COUNT(*) AS total
      FROM users
      WHERE created_at IS NOT NULL
        AND datetime(created_at) >= datetime(?)
        AND datetime(created_at) < datetime(?)
    `,
    )
    .bind(toSqlUtc(start), toSqlUtc(end))
    .first<{ total: number }>();

  return Number(row?.total ?? 0);
}

async function countUsersUntil(db: D1Database, end: Date): Promise<number> {
  const row = await db
    .prepare(
      `
      SELECT COUNT(*) AS total
      FROM users
      WHERE created_at IS NULL
         OR datetime(created_at) <= datetime(?)
    `,
    )
    .bind(toSqlUtc(end))
    .first<{ total: number }>();

  return Number(row?.total ?? 0);
}

async function countPredictions(
  db: D1Database,
  fixtureId: string,
): Promise<number> {
  const row = await db
    .prepare(
      `
      SELECT COUNT(*) AS total
      FROM predictions
      WHERE fixture_id = ?
    `,
    )
    .bind(fixtureId)
    .first<{ total: number }>();

  return Number(row?.total ?? 0);
}

adminDashboard.get('/dashboard/trends', async (c) => {
  const db = c.env.DB;
  const now = new Date();
  const localNow = getLisbonParts(now);

  const seasonStart = localDateTimeToUtc(SEASON_START_LOCAL);
  const todayStart = localDateTimeToUtc(startOfLocalDay(localNow));
  const previousDayStart = localDateTimeToUtc(
    startOfLocalDay(shiftLocalDate(localNow, -1)),
  );
  const previousDayEnd = new Date(
    previousDayStart.getTime() + (now.getTime() - todayStart.getTime()),
  );

  const [seasonRegistrations, todayCurrent, todayPrevious] = await Promise.all([
    countUsersBetween(db, seasonStart, now),
    countUsersBetween(db, todayStart, now),
    countUsersBetween(db, previousDayStart, previousDayEnd),
  ]);

  const lockMinutesRaw = Number(c.env.LOCK_MINUTES_BEFORE ?? '0');
  const lockMinutes = Number.isFinite(lockMinutesRaw)
    ? Math.max(0, lockMinutesRaw)
    : 0;
  const lockModifier = `+${lockMinutes} minutes`;

  const currentFixture = await db
    .prepare(
      `
      SELECT
        f.id,
        f.kickoff_at,
        ht.name AS home_team_name,
        at.name AS away_team_name
      FROM fixtures f
      JOIN teams ht ON ht.id = f.home_team_id
      JOIN teams at ON at.id = f.away_team_id
      WHERE f.status = 'SCHEDULED'
        AND datetime(f.kickoff_at) > datetime('now', ?)
      ORDER BY datetime(f.kickoff_at) ASC
      LIMIT 1
    `,
    )
    .bind(lockModifier)
    .first<FixtureSummary>();

  let previousFixture: FixtureSummary | null = null;
  let currentPredictions = 0;
  let previousPredictions = 0;
  let currentParticipationRate = 0;
  let previousParticipationRate = 0;

  if (currentFixture) {
    previousFixture = await db
      .prepare(
        `
        SELECT
          f.id,
          f.kickoff_at,
          ht.name AS home_team_name,
          at.name AS away_team_name
        FROM fixtures f
        JOIN teams ht ON ht.id = f.home_team_id
        JOIN teams at ON at.id = f.away_team_id
        WHERE f.id <> ?
          AND f.status = 'FINISHED'
          AND datetime(f.kickoff_at) < datetime(?)
        ORDER BY datetime(f.kickoff_at) DESC
        LIMIT 1
      `,
      )
      .bind(currentFixture.id, currentFixture.kickoff_at)
      .first<FixtureSummary>();

    const [currentPredictionCount, currentRegisteredUsers] = await Promise.all([
      countPredictions(db, currentFixture.id),
      countUsersUntil(db, now),
    ]);

    currentPredictions = currentPredictionCount;
    currentParticipationRate = safeRate(
      currentPredictions,
      currentRegisteredUsers,
    );

    if (previousFixture) {
      const previousKickoff = parseDbDate(previousFixture.kickoff_at);
      const previousLockAt = new Date(
        previousKickoff.getTime() - lockMinutes * 60_000,
      );

      const [previousPredictionCount, previousRegisteredUsers] =
        await Promise.all([
          countPredictions(db, previousFixture.id),
          countUsersUntil(db, previousLockAt),
        ]);

      previousPredictions = previousPredictionCount;
      previousParticipationRate = safeRate(
        previousPredictions,
        previousRegisteredUsers,
      );
    }
  }

  return c.json({
    registrations: {
      season: {
        current: seasonRegistrations,
        start_date: '2026-07-28',
      },
      today: {
        current: todayCurrent,
        previous: todayPrevious,
      },
    },
    predictions: {
      current: currentPredictions,
      previous: previousPredictions,
    },
    participation: {
      current: currentParticipationRate,
      previous: previousParticipationRate,
    },
    current_fixture: currentFixture
      ? {
          ...currentFixture,
          label: `${currentFixture.home_team_name} x ${currentFixture.away_team_name}`,
        }
      : null,
    previous_fixture: previousFixture
      ? {
          ...previousFixture,
          label: `${previousFixture.home_team_name} x ${previousFixture.away_team_name}`,
        }
      : null,
  });
});
