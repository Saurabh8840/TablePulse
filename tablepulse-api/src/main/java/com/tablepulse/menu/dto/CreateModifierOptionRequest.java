package com.tablepulse.menu.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class CreateModifierOptionRequest {

    @NotBlank(message = "Option name is required")
    @Size(max = 50)
    private String name;

    @DecimalMin(value = "0.00")
    private BigDecimal additionalPrice = BigDecimal.ZERO;

    private boolean defaultOption = false;

    private boolean available = true;

    @Min(0)
    private int displayOrder = 0;
}
