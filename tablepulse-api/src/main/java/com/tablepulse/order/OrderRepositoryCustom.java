package com.tablepulse.order;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface OrderRepositoryCustom {
    List<Order> search(UUID tenantId, UUID branchId, OrderStatus status, Instant from, Instant to);
}
