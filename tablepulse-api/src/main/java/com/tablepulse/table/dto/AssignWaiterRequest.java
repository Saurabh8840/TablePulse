package com.tablepulse.table.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class AssignWaiterRequest {

    /** Waiter user id, or null to return the table to house (unassigned). */
    private UUID assignedWaiterId;
}
