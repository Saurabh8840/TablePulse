package com.tablepulse.waiter.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

/**
 * One row of the waiter table grid — static table data plus live derived status.
 * Display statuses: EMPTY (no active session), OCCUPIED (seated, no live orders),
 * ORDERED (has PLACED), PREPARING (has ACCEPTED/PREPARING), READY (has READY).
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
}
