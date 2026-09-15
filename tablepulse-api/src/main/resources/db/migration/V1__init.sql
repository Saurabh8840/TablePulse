-- TablePulse Phase 0: baseline migration
-- Verifies Flyway wiring. Real tables arrive in Phase 1 (tenants, users).
-- This table is only for Phase 0 health verification and will stay.

CREATE TABLE IF NOT EXISTS flyway_baseline_check (
    id SERIAL PRIMARY KEY,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
