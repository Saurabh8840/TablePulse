package com.tablepulse.order;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface OrderItemModifierRepository extends JpaRepository<OrderItemModifier, UUID> {
    List<OrderItemModifier> findByOrderItemIdIn(List<UUID> orderItemIds);
}
