-- TablePulse rush-hour scale: live-ticket polls filter + sort server-side.
-- idx_orders_branch_status (V4) covers equality; this composite also serves
-- the placed_at ASC ordering so KDS/waiter 7s polls stay flat at 100+ live.
CREATE INDEX IF NOT EXISTS idx_orders_branch_status_placed
    ON orders(branch_id, status, placed_at);
