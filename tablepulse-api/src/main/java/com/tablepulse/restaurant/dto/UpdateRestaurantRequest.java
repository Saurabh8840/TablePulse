package com.tablepulse.restaurant.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpdateRestaurantRequest {

    @Size(max = 100)
    private String name;

    private String description;

    @Size(max = 500)
    private String logoUrl;

    @Size(max = 500)
    private String coverUrl;

    @Size(max = 60)
    private String category;

    @Size(max = 200)
    private String cuisine;

    @Size(max = 120)
    private String ownerName;

    @Size(max = 30)
    private String ownerPhone;

    @Size(max = 160)
    private String ownerEmail;

    @Size(min = 3, max = 3, message = "Currency must be a 3-letter code")
    private String currency;

    @DecimalMin(value = "0.00")
    @DecimalMax(value = "100.00")
    private BigDecimal taxPercentage;

    @DecimalMin(value = "0.00")
    @DecimalMax(value = "100.00")
    private BigDecimal serviceChargePercentage;

    private Boolean active;
}
