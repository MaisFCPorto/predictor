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
