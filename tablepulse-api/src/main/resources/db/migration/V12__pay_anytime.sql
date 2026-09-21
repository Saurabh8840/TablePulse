-- TablePulse Phase 6b: pay-anytime (Domino's prepaid) + pay-later, waiter-only close.
-- Payment no longer closes the session, so a session can hold MULTIPLE
-- COMPLETED payments (top-ups when the customer orders more after paying).
-- Bill math stays in OrderService.bill(); paid math = SUM(payments.total_amount).

-- Allow multiple COMPLETED payments per session (was: one).
DROP INDEX IF EXISTS uq_payments_session_completed;

-- Optional payer identity for receipts + waiter collection (no login/OTP).
ALTER TABLE payments ADD COLUMN IF NOT EXISTS customer_name VARCHAR(100);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_payments_session_status ON payments(session_id, status);
