-- TablePulse Phase 3: Customer QR Ordering (PRD 8)

CREATE TABLE IF NOT EXISTS table_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES restaurant_tables(id),
    session_token VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sessions_table_id ON table_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON table_sessions(session_token);

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(20) NOT NULL UNIQUE,
    session_id UUID NOT NULL REFERENCES table_sessions(id),
    table_id UUID NOT NULL REFERENCES restaurant_tables(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    status VARCHAR(20) NOT NULL DEFAULT 'PLACED',
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,
    special_instructions TEXT,
    placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    preparing_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    served_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_session_id ON orders(session_id);
CREATE INDEX IF NOT EXISTS idx_orders_branch_status ON orders(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id),
    menu_item_name VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL,
    modifiers_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_price DECIMAL(10,2) NOT NULL,
    special_instructions TEXT
);
CREATE INDEX IF NOT EXISTS idx_orderitems_order_id ON order_items(order_id);

CREATE TABLE IF NOT EXISTS order_item_modifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id UUID NOT NULL REFERENCES order_items(id),
    modifier_option_id UUID NOT NULL REFERENCES modifier_options(id),
    modifier_name VARCHAR(50) NOT NULL,
    additional_price DECIMAL(10,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oimods_item_id ON order_item_modifiers(order_item_id);

-- Sequential order numbers per branch per day (ORD-1042 style).
CREATE TABLE IF NOT EXISTS order_number_counters (
    branch_id UUID NOT NULL REFERENCES branches(id),
    day DATE NOT NULL,
    last_number INTEGER NOT NULL DEFAULT 1000,
    PRIMARY KEY (branch_id, day)
);
