import { Hono } from 'hono';
import type { Env } from '../admin';
import { requireAdminKey } from '../admin';

export const adminPlayers = new Hono<{ Bindings: Env }>();

adminPlayers.use('*', requireAdminKey);

const POSITIONS = new Set(['GR', 'D', 'M', 'A']);

function normalizePosition(value: unknown): string | null {
  const position = String(value ?? '').trim().toUpperCase();
  return POSITIONS.has(position) ? position : null;
}

function activeValue(value: unknown, fallback = 1): number {
  if (value === undefined || value === null) return fallback;
  return value === false || value === 0 || value === '0' ? 0 : 1;
}

adminPlayers.get('/', async (c) => {
  const teamId = c.req.query('team_id')?.trim() || 'fcp';
  const includeInactive = ['1', 'true', 'yes'].includes(
    (c.req.query('include_inactive') ?? '').toLowerCase(),
  );

  const sql = `
    SELECT id, team_id, name, position, is_active, created_at, updated_at
    FROM players
    WHERE team_id = ?
      ${includeInactive ? '' : 'AND is_active = 1'}
    ORDER BY
      is_active DESC,
      CASE position
        WHEN 'GR' THEN 1
        WHEN 'D'  THEN 2
        WHEN 'M'  THEN 3
        WHEN 'A'  THEN 4
        ELSE 5
      END,
      name COLLATE NOCASE
  `;

  const { results } = await c.env.DB.prepare(sql)
    .bind(teamId)
    .all<{
      id: number;
      team_id: string;
      name: string;
      position: string;
      is_active: number;
      created_at: string | null;
      updated_at: string | null;
    }>();

  return c.json(results ?? []);
});

adminPlayers.post('/', async (c) => {
  const body = (await c.req.json().catch(() => null)) as
    | {
        team_id?: unknown;
        name?: unknown;
        position?: unknown;
        is_active?: unknown;
      }
    | null;

  if (!body) return c.json({ error: 'invalid_json' }, 400);

  const teamId = String(body.team_id ?? 'fcp').trim();
  const name = String(body.name ?? '').trim();
  const position = normalizePosition(body.position);
  const isActive = activeValue(body.is_active, 1);

  if (!teamId || !name || !position) {
    return c.json({ error: 'missing_or_invalid_fields' }, 400);
  }

  const duplicate = await c.env.DB.prepare(
    `
    SELECT id
    FROM players
    WHERE team_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?))
    LIMIT 1
    `,
  )
    .bind(teamId, name)
    .first<{ id: number }>();

  if (duplicate) {
    return c.json({ error: 'player_already_exists', id: duplicate.id }, 409);
  }

  await c.env.DB.prepare(
    `
    INSERT INTO players (team_id, name, position, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
  )
    .bind(teamId, name, position, isActive)
    .run();

  return c.json({ ok: true }, 201);
});

adminPlayers.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = (await c.req.json().catch(() => null)) as
    | {
        team_id?: unknown;
        name?: unknown;
        position?: unknown;
        is_active?: unknown;
      }
    | null;

  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'invalid_id' }, 400);
  if (!body) return c.json({ error: 'invalid_json' }, 400);

  const current = await c.env.DB.prepare(
    `
    SELECT id, team_id, name, position, is_active
    FROM players
    WHERE id = ?
    LIMIT 1
    `,
  )
    .bind(id)
    .first<{
      id: number;
      team_id: string;
      name: string;
      position: string;
      is_active: number;
    }>();

  if (!current) return c.json({ error: 'player_not_found' }, 404);

  const teamId =
    body.team_id === undefined ? current.team_id : String(body.team_id).trim();
  const name = body.name === undefined ? current.name : String(body.name).trim();
  const position =
    body.position === undefined ? current.position : normalizePosition(body.position);
  const isActive = activeValue(body.is_active, current.is_active);

  if (!teamId || !name || !position) {
    return c.json({ error: 'missing_or_invalid_fields' }, 400);
  }

  const duplicate = await c.env.DB.prepare(
    `
    SELECT id
    FROM players
    WHERE team_id = ?
      AND LOWER(TRIM(name)) = LOWER(TRIM(?))
      AND id <> ?
    LIMIT 1
    `,
  )
    .bind(teamId, name, id)
    .first<{ id: number }>();

  if (duplicate) {
    return c.json({ error: 'player_already_exists', id: duplicate.id }, 409);
  }

  await c.env.DB.prepare(
    `
    UPDATE players
    SET team_id = ?, name = ?, position = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
  )
    .bind(teamId, name, position, isActive, id)
    .run();

  return c.json({ ok: true });
});
