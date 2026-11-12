ALTER TABLE hub_news ADD COLUMN source_excerpt TEXT;

CREATE TABLE hub_news_summaries (
  news_id INTEGER PRIMARY KEY REFERENCES hub_news(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'queued'
    CHECK (state IN ('queued', 'processing', 'draft', 'approved', 'rejected', 'failed', 'insufficient')),
  input_hash TEXT NOT NULL DEFAULT '',
  headline TEXT,
  body TEXT,
  model TEXT,
  generated_at TEXT,
  approved_at TEXT,
  response_json TEXT CHECK (response_json IS NULL OR json_valid(response_json)),
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_token TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  edit_token TEXT,
  last_error TEXT
);
CREATE INDEX hub_news_summaries_queue ON hub_news_summaries(state, lease_until);

-- Count every reserved provider request, including unsuccessful attempts.
CREATE TABLE hub_news_summary_usage (
  day TEXT PRIMARY KEY,
  requests INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0
);
