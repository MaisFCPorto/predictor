-- 003_users_add_profile.sql

-- Adiciona as colunas em falta
ALTER TABLE users ADD COLUMN name TEXT;
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';

-- Opcional: backfill para linhas existentes (porque DEFAULT só se aplica a novas linhas)
UPDATE users SET role = 'user' WHERE role IS NULL;
