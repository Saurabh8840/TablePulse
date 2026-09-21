package com.tablepulse.waiter.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * One row of the waiter table grid — static table data plus live derived status.
 * Display statuses: EMPTY (no active session), OCCUPIED (seated, no live orders),
 * ORDERED (has PLACED), PREPARING (has ACCEPTED/PREPARING), READY (has READY).
 * Payment fields: UNPAID (nothing paid yet), PARTIAL, PAID; null when no session.
 */
@Data
@AllArgsConstructor
public class TableStatusResponse {
    private UUID tableId;
    private String tableNumber;
    private int seatingCapacity;
    private String tableStatus;
    private String displayStatus;
    private UUID sessionId;
    private int activeOrderCount;
    private int readyOrderCount;
    private Instant oldestPlacedAt;
    private UUID assignedWaiterId;
    private String assignedWaiterName;
    private BigDecimal paidTotal;
    private BigDecimal balanceDue;
    private String paymentStatus;
    private boolean pendingCash;
}
