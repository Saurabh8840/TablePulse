package com.tablepulse.payment;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface PaymentRepositoryCustom {
    List<Payment> search(UUID tenantId, UUID branchId, Instant from, Instant to);
}
