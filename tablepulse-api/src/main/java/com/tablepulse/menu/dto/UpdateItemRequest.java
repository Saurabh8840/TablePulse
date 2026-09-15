package com.tablepulse.menu.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpdateItemRequest {

    @Size(max = 100)
    private String name;

    private String description;

    @DecimalMin(value = "0.00", message = "Price must be >= 0")
    private BigDecimal price;

    private Boolean vegetarian;

    private Boolean available;

    private Integer preparationTimeMinutes;

    @Min(0)
    private Integer displayOrder;

    private Boolean active;
}
