package com.tablepulse.order;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

public interface OrderNumberCounterRepository
        extends JpaRepository<OrderNumberCounter, OrderNumberCounter.CounterId> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<OrderNumberCounter> findByBranchIdAndDay(UUID branchId, LocalDate day);

    Optional<OrderNumberCounter> findFirstByBranchIdAndDayLessThanOrderByDayDesc(UUID branchId, LocalDate day);
}
