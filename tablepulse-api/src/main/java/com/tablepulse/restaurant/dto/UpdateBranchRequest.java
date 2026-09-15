package com.tablepulse.restaurant.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateBranchRequest {

    @Size(max = 100)
    private String name;

    private String address;

    @Size(max = 20)
    private String phone;

    private String openingTime;

    private String closingTime;

    private Boolean active;
}
