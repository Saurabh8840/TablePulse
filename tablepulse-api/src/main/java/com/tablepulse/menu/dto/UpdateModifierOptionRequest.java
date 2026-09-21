package com.tablepulse.menu.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpdateModifierOptionRequest {

    @Size(max = 50)
    private String name;

    @DecimalMin(value = "0.00")
    private BigDecimal additionalPrice;

    private Boolean defaultOption;

    private Boolean available;

    @Min(0)
    private Integer displayOrder;
}
