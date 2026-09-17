-- TablePulse: order numbers are continuous per branch (never restart daily).
-- The per-day restart regenerated ORD-1001 each day and collided with
-- uq_orders_branch_number(branch_id, order_number), permanently failing
-- every new order (the counter increment rolled back with the order).
-- Seed each branch's newest counter row past its historical max so
-- numbering resumes above history. V6's suffixed rows (ORD-1001-2) are ignored.
WITH maxnum AS (
    SELECT branch_id,
           MAX((regexp_match(order_number, '^ORD-(\d+)$'))[1]::int) AS max_n
    FROM orders
    GROUP BY branch_id
)
UPDATE order_number_counters c
SET last_number = GREATEST(c.last_number, m.max_n)
FROM maxnum m
WHERE c.branch_id = m.branch_id
  AND m.max_n IS NOT NULL
  AND c.day = (SELECT MAX(c2.day) FROM order_number_counters c2 WHERE c2.branch_id = c.branch_id);
