package com.tablepulse.restaurant.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.UUID;

@Data
@AllArgsConstructor
public class BranchResponse {
    private UUID id;
    private UUID restaurantId;
    private String name;
    private String address;
    private String phone;
    private String openingTime;
    private String closingTime;
    private boolean active;
}
