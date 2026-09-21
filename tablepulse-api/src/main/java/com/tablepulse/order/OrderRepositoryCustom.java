package com.tablepulse.order;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface OrderRepositoryCustom {
    List<Order> search(UUID tenantId, UUID branchId, OrderStatus status, Instant from, Instant to);

    /**
     * Rush-hour poll: only live kitchen tickets for a branch, oldest first.
     * Backed by idx_orders_branch_status_placed — flat latency at 100+ live.
     */
    List<Order> findLive(UUID tenantId, UUID branchId);
}
