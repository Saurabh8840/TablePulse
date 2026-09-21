package com.tablepulse.auth.dto;

import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class UpdateStaffRequest {

    private Boolean active;

    /**
     * Move staff to another branch (Fix 2). Null = leave unchanged.
     * Clearing to null is only allowed for MANAGER (all branches);
     * WAITER/KITCHEN_STAFF must always belong to a branch.
     */
    private UUID branchId;

    /** Replaces the waiter's table assignment (null = leave unchanged). */
    private List<UUID> tableIds;
}
