-- Complements 001/006/007/009/016/019/020, never runs against a remote DB.
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
CREATE TABLE players (
  id INTEGER PRIMARY KEY,
  team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);
