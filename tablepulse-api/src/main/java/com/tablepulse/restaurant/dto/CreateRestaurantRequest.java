package com.tablepulse.restaurant.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class CreateRestaurantRequest {

    @NotBlank(message = "Name is required")
    @Size(max = 100)
    private String name;

    private String description;

    @Size(max = 500)
    private String logoUrl;

    @Size(min = 3, max = 3, message = "Currency must be a 3-letter code")
    private String currency = "INR";

    @DecimalMin(value = "0.00")
    @DecimalMax(value = "100.00")
    private BigDecimal taxPercentage = BigDecimal.ZERO;

    @DecimalMin(value = "0.00")
    @DecimalMax(value = "100.00")
    private BigDecimal serviceChargePercentage = BigDecimal.ZERO;
}
