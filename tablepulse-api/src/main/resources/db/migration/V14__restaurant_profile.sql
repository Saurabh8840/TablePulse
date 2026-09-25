-- Restaurant profile completion: cover image, food taxonomy, owner snapshot.
-- All nullable: existing restaurants keep working, new fields fill from the
-- registration form and remain editable from restaurant Settings.
ALTER TABLE restaurants
    ADD COLUMN cover_url VARCHAR(500),
    ADD COLUMN category VARCHAR(60),
    ADD COLUMN cuisine VARCHAR(200),
    ADD COLUMN owner_name VARCHAR(120),
    ADD COLUMN owner_phone VARCHAR(30),
    ADD COLUMN owner_email VARCHAR(160);
