-- Retention deletes rows. Reserve monotonically increasing IDs so stale
-- moderation requests and old article links cannot refer to a different story.
CREATE TABLE hub_news_sequence (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  last_id INTEGER NOT NULL
);

INSERT INTO hub_news_sequence (singleton, last_id)
SELECT 1, COALESCE(MAX(id), 0) FROM hub_news;
