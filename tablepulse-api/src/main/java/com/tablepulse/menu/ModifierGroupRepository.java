package com.tablepulse.menu;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ModifierGroupRepository extends JpaRepository<ModifierGroup, UUID> {
    List<ModifierGroup> findByMenuItemIdOrderByDisplayOrderAsc(UUID menuItemId);

    boolean existsByMenuItemIdAndNameIgnoreCase(UUID menuItemId, String name);
}
