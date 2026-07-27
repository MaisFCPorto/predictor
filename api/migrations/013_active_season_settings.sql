CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO app_settings (key, value)
VALUES ('active_season_id', 'ucl-25');

INSERT OR IGNORE INTO app_settings (key, value)
VALUES ('active_matchday_id', 'md1');
