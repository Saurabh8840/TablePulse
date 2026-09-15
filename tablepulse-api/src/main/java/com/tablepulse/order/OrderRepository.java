package com.tablepulse.order;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID>, OrderRepositoryCustom {

    List<Order> findBySessionIdOrderByPlacedAtAsc(UUID sessionId);

    List<Order> findByBranchIdAndStatusOrderByPlacedAtAsc(UUID branchId, OrderStatus status);

    @Query("SELECT COUNT(o) > 0 FROM Order o WHERE o.session.id = :sessionId AND o.status NOT IN ('CANCELLED', 'REJECTED', 'COMPLETED')")
    boolean hasOpenOrders(UUID sessionId);

    Optional<Order> findByIdAndTenantId(UUID id, UUID tenantId);
}
