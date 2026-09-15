package com.tablepulse.table.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.UUID;

@Data
@AllArgsConstructor
public class TableResponse {
    private UUID id;
    private UUID branchId;
    private String tableNumber;
    private int seatingCapacity;
    private String status;
    private String qrCodeUrl;
    private boolean active;
    private UUID assignedWaiterId;
    private String assignedWaiterName;
}
