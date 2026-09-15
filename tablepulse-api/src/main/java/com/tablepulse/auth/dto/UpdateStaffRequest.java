package com.tablepulse.auth.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateStaffRequest {

    @NotNull(message = "active is required")
    private Boolean active;
}
