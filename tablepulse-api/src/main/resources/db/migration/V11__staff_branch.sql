-- TablePulse Fix 2: staff scoped per branch (not tenant-wide).
-- Same owner with 5 restaurants (e.g. Barista Bangalore vs Noida) must not
-- see Bangalore waiters in Noida tables dropdown. Fresh restaurant shows 0 staff.
-- OWNER stays tenant-wide (branch_id NULL). WAITER/KITCHEN_STAFF belong to one
-- branch. MANAGER may be NULL (= all branches) or set to one branch.

ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id UUID NULL REFERENCES branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);
