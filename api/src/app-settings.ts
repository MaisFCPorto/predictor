export async function getRequiredAppSetting(
  db: D1Database,
  key: string,
): Promise<string> {
  const row = await db
    .prepare(`
      SELECT value
      FROM app_settings
      WHERE key = ?
      LIMIT 1
    `)
    .bind(key)
    .first<{ value: string }>();

  const value = row?.value?.trim();

  if (!value) {
    throw new Error(`missing_app_setting:${key}`);
  }

  return value;
}

export function getActiveSeasonId(db: D1Database): Promise<string> {
  return getRequiredAppSetting(db, 'active_season_id');
}

export function getActiveMatchdayId(db: D1Database): Promise<string> {
  return getRequiredAppSetting(db, 'active_matchday_id');
}
