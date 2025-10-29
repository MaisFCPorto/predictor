-- 1) Adicionar as colunas (sem DEFAULT)
ALTER TABLE users ADD COLUMN updated_at TEXT;
ALTER TABLE users ADD COLUMN last_login TEXT;

-- 2) Backfill para linhas já existentes
UPDATE users
SET
  updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP),
  last_login = COALESCE(last_login, CURRENT_TIMESTAMP);

-- 3) Triggers opcionais para manter timestamps

-- Quando INSERIR um user sem estes campos, preenche-os
DROP TRIGGER IF EXISTS trg_users_insert_defaults;
CREATE TRIGGER trg_users_insert_defaults
AFTER INSERT ON users
FOR EACH ROW
BEGIN
  UPDATE users
  SET
    updated_at = COALESCE(NEW.updated_at, CURRENT_TIMESTAMP),
    last_login = COALESCE(NEW.last_login, CURRENT_TIMESTAMP)
  WHERE id = NEW.id;
END;

-- Sempre que ATUALIZAR um user, refresca updated_at
DROP TRIGGER IF EXISTS trg_users_touch_updated_at;
CREATE TRIGGER trg_users_touch_updated_at
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
  UPDATE users
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;
