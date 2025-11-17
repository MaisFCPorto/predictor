ALTER TABLE players
ADD COLUMN updated_at TEXT;

INSERT INTO players (team_id, name, position) VALUES
  -- Guarda-redes
  ('fcp', 'Diogo Costa',       'GR'),
  ('fcp', 'Cláudio Ramos',     'GR'),
  ('fcp', 'João Costa',        'GR'),

  -- Defesas centrais
  ('fcp', 'Jakub Kiwior',      'D'),
  ('fcp', 'Nehuén Pérez',      'D'),
  ('fcp', 'Jan Bednarek',      'D'),
  ('fcp', 'Dominik Prpić',     'D'),

  -- Laterais (Defesas)
  ('fcp', 'Francisco Moura',   'D'),
  ('fcp', 'Zaidu',             'D'),
  ('fcp', 'Alberto Costa',     'D'),
  ('fcp', 'Martim Fernandes',  'D'),
  ('fcp', 'Pedro Lima',        'D'),

  -- Médios defensivos / centro / ofensivos
  ('fcp', 'Alan Varela',       'M'),
  ('fcp', 'Pablo Rosario',     'M'),
  ('fcp', 'Tomás Pérez',       'M'),
  ('fcp', 'Víctor Froholdt',   'M'),
  ('fcp', 'Stephen Eustaquio', 'M'),
  ('fcp', 'Rodrigo Mora',      'M'),
  ('fcp', 'Gabri Veiga',       'M'),

  -- Extremos (avançados)
  ('fcp', 'Borja Sainz',       'A'),
  ('fcp', 'William Gomes',     'A'),
  ('fcp', 'Yann Karamoh',      'A'),
  ('fcp', 'Pepê',              'A'),

  -- Pontas de lança (avançados)
  ('fcp', 'Samu Aghehowa',     'A'),
  ('fcp', 'Deniz Gül',         'A'),
  ('fcp', 'Luuk de Jong',      'A');
