-- 012_leagues.sql  (versão limpa)

-- Tabela de ligas
CREATE TABLE IF NOT EXISTS leagues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_leagues_code
  ON leagues(code);

CREATE INDEX IF NOT EXISTS idx_leagues_owner
  ON leagues(owner_user_id);

-- Tabela de membros da liga
CREATE TABLE IF NOT EXISTS league_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  league_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (league_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_league_members_league
  ON league_members(league_id);

CREATE INDEX IF NOT EXISTS idx_league_members_user
  ON league_members(user_id);
