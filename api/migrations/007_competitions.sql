-- 003_competitions.sql

-- 1) Tabela competitions
CREATE TABLE IF NOT EXISTS competitions (
  id    TEXT PRIMARY KEY,     -- ex: 'LP', 'LE', 'TP', 'TL'
  code  TEXT UNIQUE NOT NULL, -- redundante mas útil, igual ao id (guardamos os 2 por flex)
  name  TEXT NOT NULL         -- 'Liga Portugal', 'Liga Europa', ...
);

-- seeds iniciais
INSERT OR IGNORE INTO competitions (id, code, name) VALUES
  ('LP', 'LP', 'Liga Portugal'),
  ('LE', 'LE', 'Liga Europa'),
  ('TP', 'TP', 'Taça de Portugal'),
  ('TL', 'TL', 'Taça da Liga');

-- 2) Alterar fixtures: adicionar competition_id, round_label e leg (mão 1/2)
ALTER TABLE fixtures ADD COLUMN competition_id TEXT REFERENCES competitions(id);
ALTER TABLE fixtures ADD COLUMN round_label   TEXT;  -- ex: 'MD1', 'Quartos', 'Meias', 'Final', 'Play-off'
ALTER TABLE fixtures ADD COLUMN leg           INTEGER; -- 1 ou 2 (duas mãos), NULL se jogo único

-- Opcional: índice para listagens por competição+matchday
CREATE INDEX IF NOT EXISTS idx_fixtures_competition ON fixtures(competition_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_round ON fixtures(round_label);
