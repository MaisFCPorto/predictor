CREATE TABLE IF NOT EXISTS players (
  id         TEXT PRIMARY KEY,                  -- UUID ou similar
  team_id    TEXT NOT NULL,                     -- equipa (FC Porto)
  name       TEXT NOT NULL,
  position   TEXT NOT NULL,                     -- 'GR', 'D', 'M', 'A'
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now'))
);

CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);


CREATE TABLE IF NOT EXISTS fixture_scorers (
  id         TEXT PRIMARY KEY,
  fixture_id TEXT NOT NULL,
  player_id  TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now')),
  UNIQUE(fixture_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_fixture_scorers_fixture ON fixture_scorers(fixture_id);
CREATE INDEX IF NOT EXISTS idx_fixture_scorers_player  ON fixture_scorers(player_id);


ALTER TABLE predictions ADD COLUMN scorer_player_id TEXT NULL;
CREATE INDEX IF NOT EXISTS idx_predictions_scorer ON predictions(scorer_player_id);
