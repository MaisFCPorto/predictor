ALTER TABLE players RENAME TO players_old;

CREATE TABLE players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

INSERT INTO players (team_id, name, position, created_at, updated_at)
SELECT team_id, name, position, created_at, updated_at
FROM players_old
WHERE id IS NOT NULL;

DROP TABLE players_old;


INSERT INTO players (team_id, name, position) VALUES
  -- Guarda-redes
  ('fcp', 'Diogo Costa', 'GR'),
  ('fcp', 'Cláudio Ramos', 'GR'),
  ('fcp', 'João Costa', 'GR'),

  -- Defesas
  ('fcp', 'Jakub Kiwior', 'D'),
  ('fcp', 'Nehuén Pérez', 'D'),
  ('fcp', 'Jan Bednarek', 'D'),
  ('fcp', 'Dominik Prpić', 'D'),
  ('fcp', 'Francisco Moura', 'D'),
  ('fcp', 'Zaidu', 'D'),
  ('fcp', 'Alberto Costa', 'D'),
  ('fcp', 'Martim Fernandes', 'D'),
  ('fcp', 'Pedro Lima', 'D'),

  -- Médios
  ('fcp', 'Alan Varela', 'M'),
  ('fcp', 'Pablo Rosario', 'M'),
  ('fcp', 'Tomás Pérez', 'M'),
  ('fcp', 'Víctor Froholdt', 'M'),
  ('fcp', 'Stephen Eustaquio', 'M'),
  ('fcp', 'Rodrigo Mora', 'M'),
  ('fcp', 'Gabri Veiga', 'M'),

  -- Avançados
  ('fcp', 'Borja Sainz', 'A'),
  ('fcp', 'William Gomes', 'A'),
  ('fcp', 'Yann Karamoh', 'A'),
  ('fcp', 'Pepê', 'A'),
  ('fcp', 'Samu Aghehowa', 'A'),
  ('fcp', 'Deniz Gül', 'A'),
  ('fcp', 'Luuk de Jong', 'A');
