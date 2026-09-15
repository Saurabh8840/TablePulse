-- TablePulse: order numbers restart per branch per day (ORD-1001), so the GLOBAL
-- unique constraint on order_number is wrong -- every new day / second branch
-- regenerates ORD-1001 and collides with history. Scope uniqueness per branch.

-- 1. Repair historical duplicates: keep the earliest placed row, suffix the rest.
-- order_number is not referenced by any FK, so renumbering is safe.
WITH ranked AS (
    SELECT id, order_number,
           ROW_NUMBER() OVER (PARTITION BY order_number ORDER BY placed_at, id) AS rn
    FROM orders
)
UPDATE orders o
SET order_number = o.order_number || '-' || ranked.rn::text
FROM ranked
WHERE o.id = ranked.id AND ranked.rn > 1;

-- 2. Replace the global unique constraint with a per-branch one.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_number_key;
ALTER TABLE orders ADD CONSTRAINT uq_orders_branch_number UNIQUE (branch_id, order_number);
