-- migrations/002_users.sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                 -- supabase.auth.users.id (uuid)
  email TEXT UNIQUE,
  name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
