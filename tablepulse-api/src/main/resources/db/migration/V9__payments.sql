-- TablePulse Phase 6: mock payments with strict close (PRD §11, Razorpay deferred).
-- gateway_ref stores mock-... now, Razorpay order/payment id later.

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES table_sessions(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    service_charge DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    gateway_ref VARCHAR(100),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_session_id ON payments(session_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_branch ON payments(tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
-- One completed payment per session; retries allowed while PENDING/FAILED.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_session_completed
    ON payments(session_id) WHERE status = 'COMPLETED';
