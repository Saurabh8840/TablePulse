package com.tablepulse.menu;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ModifierOptionRepository extends JpaRepository<ModifierOption, UUID> {
    List<ModifierOption> findByGroupIdOrderByDisplayOrderAsc(UUID groupId);

    boolean existsByGroupIdAndNameIgnoreCase(UUID groupId, String name);

    List<ModifierOption> findByGroupId(UUID groupId);
}
