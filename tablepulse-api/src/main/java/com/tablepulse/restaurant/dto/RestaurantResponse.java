package com.tablepulse.restaurant.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@AllArgsConstructor
public class RestaurantResponse {
    private UUID id;
    private String name;
    private String slug;
    private String description;
    private String logoUrl;
    private String coverUrl;
    private String category;
    private String cuisine;
    private String ownerName;
    private String ownerPhone;
    private String ownerEmail;
    private String currency;
    private BigDecimal taxPercentage;
    private BigDecimal serviceChargePercentage;
    private boolean active;
}
