INSERT INTO app_settings (key, value)
VALUES ('active_season_id', '2026-27')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;

INSERT INTO app_settings (key, value)
VALUES ('active_matchday_id', 'md-2026-27')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
