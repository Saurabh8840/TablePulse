package com.tablepulse.restaurant;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RestaurantRepository extends JpaRepository<Restaurant, UUID> {
    List<Restaurant> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);

    Optional<Restaurant> findBySlug(String slug);

    boolean existsBySlug(String slug);
}
