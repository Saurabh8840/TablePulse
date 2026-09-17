package com.tablepulse.payment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PaymentRepository extends JpaRepository<Payment, UUID>, PaymentRepositoryCustom {

    List<Payment> findBySessionIdOrderByCreatedAtDesc(UUID sessionId);

    Optional<Payment> findFirstBySessionIdAndStatusOrderByCreatedAtDesc(UUID sessionId, PaymentStatus status);
}
