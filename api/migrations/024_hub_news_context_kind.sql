-- Preserve previous context without guessing whether it came from a feed or an editor.
ALTER TABLE hub_news ADD COLUMN context_kind TEXT NOT NULL DEFAULT 'legacy'
  CHECK (context_kind IN ('legacy', 'feed', 'article', 'manual'));
