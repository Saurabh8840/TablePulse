package com.tablepulse.table;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RestaurantTableRepository extends JpaRepository<RestaurantTable, UUID> {
    List<RestaurantTable> findByBranchIdOrderByTableNumber(UUID branchId);

    boolean existsByBranchIdAndTableNumber(UUID branchId, String tableNumber);

    Optional<RestaurantTable> findByBranchIdAndTableNumber(UUID branchId, String tableNumber);
}
