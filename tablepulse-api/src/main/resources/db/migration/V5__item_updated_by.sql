-- TablePulse Phase 5b: track who last changed a menu item (owner sees "Sold out - by Tanish").
-- updated_at already exists on menu_items; only the "who" is new.

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS updated_by UUID NULL REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_menu_items_updated_by ON menu_items(updated_by);
