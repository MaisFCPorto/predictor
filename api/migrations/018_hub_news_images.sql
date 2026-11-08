ALTER TABLE hub_news ADD COLUMN image_url TEXT;
ALTER TABLE hub_news ADD COLUMN image_approved INTEGER NOT NULL DEFAULT 0 CHECK (image_approved IN (0, 1));
