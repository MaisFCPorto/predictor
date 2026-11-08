CREATE TABLE hub_rating_matches (
  fixture_id TEXT NOT NULL PRIMARY KEY REFERENCES fixtures(id) ON DELETE CASCADE
);

CREATE TABLE hub_rating_players (
  fixture_id TEXT NOT NULL REFERENCES hub_rating_matches(fixture_id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id),
  PRIMARY KEY (fixture_id, player_id)
);

CREATE TABLE hub_player_ratings (
  fixture_id TEXT NOT NULL,
  player_id INTEGER NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (typeof(rating) = 'integer' AND rating BETWEEN 1 AND 10),
  PRIMARY KEY (fixture_id, player_id, user_id),
  FOREIGN KEY (fixture_id, player_id) REFERENCES hub_rating_players(fixture_id, player_id) ON DELETE CASCADE
);

CREATE INDEX hub_player_ratings_ballot ON hub_player_ratings(fixture_id, user_id);
