package com.tablepulse.restaurant;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BranchRepository extends JpaRepository<Branch, UUID> {
    List<Branch> findByRestaurantIdOrderByCreatedAt(UUID restaurantId);
}
