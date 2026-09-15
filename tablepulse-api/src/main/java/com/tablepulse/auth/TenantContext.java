package com.tablepulse.auth;

import java.util.UUID;

/**
 * Holds the current tenant for the request thread.
 * Set by JwtAuthFilter from the verified JWT, cleared after the request.
 * Phase 2+ repositories/services filter every query by this id.
 */
public final class TenantContext {

    private static final ThreadLocal<UUID> CURRENT = new ThreadLocal<>();

    private TenantContext() {
    }

    public static void set(UUID tenantId) {
        CURRENT.set(tenantId);
    }

    public static UUID get() {
        return CURRENT.get();
    }

    public static void clear() {
        CURRENT.remove();
    }
}
