-- The calendar is staging data. Importing it must not open every fixture.
CREATE TABLE football_team_links (
  kgmid TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id)
);
INSERT INTO football_team_links (kgmid, team_id)
SELECT '/m/0177gl', id FROM teams WHERE id = 'fcp';

CREATE TABLE football_competition_links (
  kgmid TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id)
);
INSERT INTO football_competition_links (kgmid, competition_id)
SELECT '/m/03n_lr', id FROM competitions WHERE code = 'LP';
INSERT INTO football_competition_links (kgmid, competition_id)
SELECT '/m/03qdvf', id FROM competitions WHERE code = 'TP';
INSERT INTO football_competition_links (kgmid, competition_id)
SELECT '/m/02797xr', id FROM competitions WHERE code = 'TL';

CREATE TABLE football_sync_state (
  season_id TEXT PRIMARY KEY REFERENCES seasons(id),
  refreshed_at INTEGER,
  refresh_after INTEGER NOT NULL DEFAULT 0,
  lease_token TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE football_calendar (
  season_id TEXT NOT NULL REFERENCES seasons(id),
  kgmid TEXT NOT NULL,
  kickoff_at TEXT,
  kickoff_date TEXT,
  kickoff_confirmed INTEGER NOT NULL CHECK (kickoff_confirmed IN (0, 1)),
  provider_status TEXT,
  calendar_json TEXT NOT NULL CHECK (json_valid(calendar_json)),
  fixture_id TEXT UNIQUE REFERENCES fixtures(id) ON DELETE SET NULL,
  final_json TEXT CHECK (final_json IS NULL OR json_valid(final_json)),
  finalized_at INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  check_after INTEGER NOT NULL DEFAULT 0,
  lease_token TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  PRIMARY KEY (season_id, kgmid)
);
CREATE INDEX football_calendar_due ON football_calendar(season_id, finalized_at, check_after);
