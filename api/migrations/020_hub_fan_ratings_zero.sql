CREATE TABLE hub_player_ratings_new (
  fixture_id TEXT NOT NULL,
  player_id INTEGER NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (typeof(rating) = 'integer' AND rating BETWEEN 0 AND 10),
  PRIMARY KEY (fixture_id, player_id, user_id),
  FOREIGN KEY (fixture_id, player_id) REFERENCES hub_rating_players(fixture_id, player_id) ON DELETE CASCADE
);

INSERT INTO hub_player_ratings_new (fixture_id, player_id, user_id, rating)
SELECT fixture_id, player_id, user_id, rating FROM hub_player_ratings;

DROP TABLE hub_player_ratings;
ALTER TABLE hub_player_ratings_new RENAME TO hub_player_ratings;
CREATE INDEX hub_player_ratings_ballot ON hub_player_ratings(fixture_id, user_id);
