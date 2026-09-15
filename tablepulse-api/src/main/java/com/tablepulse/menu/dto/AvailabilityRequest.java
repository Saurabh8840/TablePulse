package com.tablepulse.menu.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AvailabilityRequest {

    @NotNull(message = "available is required")
    private Boolean available;
}
