PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE seasons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE matchdays (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES seasons(id),
  name TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL
);

CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT,
  crest_url TEXT
);

CREATE TABLE fixtures (
  id TEXT PRIMARY KEY,
  matchday_id TEXT NOT NULL REFERENCES matchdays(id),
  home_team_id TEXT NOT NULL REFERENCES teams(id),
  away_team_id TEXT NOT NULL REFERENCES teams(id),
  kickoff_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  home_score INTEGER,
  away_score INTEGER
);

CREATE TABLE predictions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  fixture_id TEXT NOT NULL REFERENCES fixtures(id),
  home_goals INTEGER NOT NULL,
  away_goals INTEGER NOT NULL,
  first_to_score TEXT CHECK(first_to_score IN ('HOME','AWAY','NONE')),
  booster_used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, fixture_id)
);

CREATE TABLE leagues (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'PRIVATE'
);

CREATE TABLE league_members (
  league_id TEXT NOT NULL REFERENCES leagues(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'MEMBER',
  PRIMARY KEY (league_id, user_id)
);

CREATE TABLE scores (
  user_id TEXT NOT NULL REFERENCES users(id),
  matchday_id TEXT NOT NULL REFERENCES matchdays(id),
  points INTEGER NOT NULL,
  PRIMARY KEY (user_id, matchday_id)
);

CREATE INDEX idx_predictions_user ON predictions(user_id);
CREATE INDEX idx_predictions_fixture ON predictions(fixture_id);
CREATE INDEX idx_fixtures_matchday ON fixtures(matchday_id);
