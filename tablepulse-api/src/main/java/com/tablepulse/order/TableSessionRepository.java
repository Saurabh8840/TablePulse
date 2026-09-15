package com.tablepulse.order;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TableSessionRepository extends JpaRepository<TableSession, UUID> {
    Optional<TableSession> findBySessionToken(String sessionToken);

    List<TableSession> findByTableIdAndStatus(UUID tableId, String status);
}
