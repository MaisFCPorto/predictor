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

function safeRate(participants: number, eligibleUsers: number): number {
  if (eligibleUsers <= 0) return 0;
  return (participants / eligibleUsers) * 100;
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

async function countPredictionsUntil(
  db: D1Database,
  fixtureId: string,
  end: Date,
): Promise<{ predictions: number; participants: number }> {
  const row = await db
    .prepare(
      `
      SELECT
        COUNT(*) AS predictions,
        COUNT(DISTINCT user_id) AS participants
      FROM predictions
      WHERE fixture_id = ?
        AND datetime(created_at) <= datetime(?)
    `,
    )
    .bind(fixtureId, toSqlUtc(end))
    .first<{ predictions: number; participants: number }>();

  return {
    predictions: Number(row?.predictions ?? 0),
    participants: Number(row?.participants ?? 0),
  };
}

adminDashboard.get('/dashboard/trends', async (c) => {
  const db = c.env.DB;
  const now = new Date();
  const localNow = getLisbonParts(now);

  const localDate = new Date(
    Date.UTC(localNow.year, localNow.month - 1, localNow.day),
  );
  const daysSinceMonday = (localDate.getUTCDay() + 6) % 7;

  const currentWeekStart = localDateTimeToUtc(
    startOfLocalDay(shiftLocalDate(localNow, -daysSinceMonday)),
  );
  const previousWeekStart = localDateTimeToUtc(
    startOfLocalDay(shiftLocalDate(localNow, -daysSinceMonday - 7)),
  );
  const previousWeekEnd = new Date(
    previousWeekStart.getTime() + (now.getTime() - currentWeekStart.getTime()),
  );

  const todayStart = localDateTimeToUtc(startOfLocalDay(localNow));
  const previousDayStart = localDateTimeToUtc(
    startOfLocalDay(shiftLocalDate(localNow, -7)),
  );
  const previousDayEnd = new Date(
    previousDayStart.getTime() + (now.getTime() - todayStart.getTime()),
  );

  const [weekCurrent, weekPrevious, todayCurrent, todayPrevious] =
    await Promise.all([
      countUsersBetween(db, currentWeekStart, now),
      countUsersBetween(db, previousWeekStart, previousWeekEnd),
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
  let comparisonAt: string | null = null;

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
          AND datetime(f.kickoff_at) < datetime(?)
        ORDER BY datetime(f.kickoff_at) DESC
        LIMIT 1
      `,
      )
      .bind(currentFixture.id, currentFixture.kickoff_at)
      .first<FixtureSummary>();

    const currentKickoff = parseDbDate(currentFixture.kickoff_at);
    const currentLockAt = new Date(
      currentKickoff.getTime() - lockMinutes * 60_000,
    );
    const remainingUntilLock = Math.max(
      0,
      currentLockAt.getTime() - now.getTime(),
    );

    const [currentCounts, currentEligibleUsers] = await Promise.all([
      countPredictionsUntil(db, currentFixture.id, now),
      countUsersUntil(db, now),
    ]);

    currentPredictions = currentCounts.predictions;
    currentParticipationRate = safeRate(
      currentCounts.participants,
      currentEligibleUsers,
    );

    if (previousFixture) {
      const previousKickoff = parseDbDate(previousFixture.kickoff_at);
      const previousLockAt = new Date(
        previousKickoff.getTime() - lockMinutes * 60_000,
      );
      const previousComparisonAt = new Date(
        previousLockAt.getTime() - remainingUntilLock,
      );
      comparisonAt = previousComparisonAt.toISOString();

      const [previousCounts, previousEligibleUsers] = await Promise.all([
        countPredictionsUntil(
          db,
          previousFixture.id,
          previousComparisonAt,
        ),
        countUsersUntil(db, previousComparisonAt),
      ]);

      previousPredictions = previousCounts.predictions;
      previousParticipationRate = safeRate(
        previousCounts.participants,
        previousEligibleUsers,
      );
    }
  }

  return c.json({
    registrations: {
      week: {
        current: weekCurrent,
        previous: weekPrevious,
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
    comparison_at: comparisonAt,
  });
});
