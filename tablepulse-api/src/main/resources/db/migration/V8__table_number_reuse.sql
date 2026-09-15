-- TablePulse: allow reusing numbers of deleted (inactive) tables.
-- The old UNIQUE(branch_id, table_number) covered retired rows, so a deleted T7
-- could never be recreated. History stays intact (rows are never removed).

ALTER TABLE restaurant_tables DROP CONSTRAINT IF EXISTS uq_tables_branch_number;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tables_branch_number_active
    ON restaurant_tables(branch_id, table_number) WHERE is_active;
