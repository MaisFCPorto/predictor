INSERT OR IGNORE INTO users(id,email) VALUES ('demo-user','demo@predictor.local');

INSERT OR REPLACE INTO seasons(id,name) VALUES ('ucl-25','UCL 2025/26');

INSERT OR REPLACE INTO matchdays(id,season_id,name,starts_at,ends_at)
VALUES ('md1','ucl-25','Matchday 1','2025-10-20 18:00:00','2025-10-23 23:59:00');

INSERT OR REPLACE INTO teams(id,name,short_name) VALUES
('fcp','FC Porto','FCP'),
('pal','Palmeiras','PAL'),
('mci','Man City','MCI'),
('rma','Real Madrid','RMA');

INSERT OR REPLACE INTO fixtures(id,matchday_id,home_team_id,away_team_id,kickoff_at,competition_id) VALUES
('g1','md1','fcp','rma','2025-10-21 20:00:00','TP'),
('g2','md1','mci','pal','2025-10-21 20:00:00','TL'),
('g3','md1','fcp','pal','2025-10-22 20:00:00','LP'),
('g4','md1','rma','mci','2025-10-22 20:00:00','LE'),
('g5','md1','pal','rma','2025-10-23 20:00:00','TP'),
('g6','md1','mci','fcp','2025-12-23 20:00:00','TP');

-- Ensure fixtures count for rankings (must be FINISHED)
UPDATE fixtures SET status='FINISHED', home_score=2, away_score=1 WHERE id='g1';
UPDATE fixtures SET status='FINISHED', home_score=3, away_score=0 WHERE id='g2';
UPDATE fixtures SET status='FINISHED', home_score=1, away_score=1 WHERE id='g3';
UPDATE fixtures SET status='FINISHED', home_score=0, away_score=2 WHERE id='g4';
UPDATE fixtures SET status='FINISHED', home_score=2, away_score=2 WHERE id='g5';
UPDATE fixtures SET status='FINISHED', home_score=1, away_score=0 WHERE id='g6';

-- Bulk users for pagination testing
-- Creates users seed-001 .. seed-200
WITH RECURSIVE seq(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < 200
)
INSERT OR IGNORE INTO users(id, email, name, avatar_url, role)
SELECT
  'seed-' || printf('%03d', n) AS id,
  'seed' || printf('%03d', n) || '@predictor.local' AS email,
  'Seed Player ' || printf('%03d', n) AS name,
  NULL AS avatar_url,
  'user' AS role
FROM seq;

-- Bulk predictions: every seeded user predicts every seeded fixture
WITH RECURSIVE seq(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < 200
),
fx(fid) AS (
  VALUES ('g1'),('g2'),('g3'),('g4'),('g5'),('g6')
)
INSERT OR IGNORE INTO predictions(
  id,
  user_id,
  fixture_id,
  home_goals,
  away_goals,
  first_to_score,
  booster_used,
  created_at,
  scorer_player_id
)
SELECT
  'pred-' || printf('%03d', n) || '-' || fid AS id,
  'seed-' || printf('%03d', n) AS user_id,
  fid AS fixture_id,
  (n + length(fid)) % 4 AS home_goals,
  (n + length(fid) * 2) % 3 AS away_goals,
  'NONE' AS first_to_score,
  0 AS booster_used,
  strftime('%Y-%m-%dT%H:%M:%fZ','now','-' || (n % 40) || ' days') AS created_at,
  NULL AS scorer_player_id
FROM seq
CROSS JOIN fx;
