-- 004_users_add_profile.sql

-- Nome completo do utilizador (nullable)
ALTER TABLE users ADD COLUMN name TEXT;

-- Avatar (nullable)
ALTER TABLE users ADD COLUMN avatar_url TEXT;

-- Role do utilizador (not null com default)
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';

-- Data de atualização (nullable, definimos no código)
ALTER TABLE users ADD COLUMN updated_at TEXT;

-- (Opcional) backfill rápido para linhas existentes
UPDATE users
SET role = COALESCE(role, 'user');
