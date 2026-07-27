INSERT OR IGNORE INTO seasons (id, name)
VALUES ('2026-27', 'Época 2026/27');

INSERT OR IGNORE INTO matchdays (
  id,
  season_id,
  name,
  starts_at,
  ends_at
)
VALUES (
  'md-2026-27',
  '2026-27',
  'Época 2026/27',
  '2026-07-27 00:00:00',
  '2027-06-30 23:59:59'
);
