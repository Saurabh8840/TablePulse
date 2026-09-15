-- TablePulse: waiter table ownership + cover attribution.
-- Owner assigns tables to waiters; serving/closing another's table stays allowed
-- but records who did it (served_by / closed_by).

ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS assigned_waiter_id UUID NULL REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_tables_assigned_waiter ON restaurant_tables(assigned_waiter_id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS served_by UUID NULL REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_orders_served_by ON orders(served_by);

ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS closed_by UUID NULL REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_sessions_closed_by ON table_sessions(closed_by);
