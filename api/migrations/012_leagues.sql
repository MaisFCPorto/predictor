-- Completa o esquema de ligas criado em 001_init.sql

ALTER TABLE leagues
ADD COLUMN ranking_from TEXT;

CREATE INDEX IF NOT EXISTS idx_leagues_owner
  ON leagues(owner_id);

CREATE INDEX IF NOT EXISTS idx_league_members_league
  ON league_members(league_id);

CREATE INDEX IF NOT EXISTS idx_league_members_user
  ON league_members(user_id);
