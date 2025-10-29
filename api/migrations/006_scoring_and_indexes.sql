-- 006_scoring_and_indexes.sql

-- 1) Pontos por palpite
ALTER TABLE predictions
  ADD COLUMN points INTEGER NOT NULL DEFAULT 0;

-- 2) (Opcional) Quando foi calculado
ALTER TABLE predictions
  ADD COLUMN scored_at TEXT;

-- 3) Índices úteis
CREATE INDEX IF NOT EXISTS idx_predictions_fixture ON predictions(fixture_id);
CREATE INDEX IF NOT EXISTS idx_predictions_user ON predictions(user_id);
