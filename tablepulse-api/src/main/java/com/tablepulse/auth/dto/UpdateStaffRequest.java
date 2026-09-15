package com.tablepulse.auth.dto;

import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class UpdateStaffRequest {

    private Boolean active;

    /** Replaces the waiter's table assignment (null = leave unchanged). */
    private List<UUID> tableIds;
}
