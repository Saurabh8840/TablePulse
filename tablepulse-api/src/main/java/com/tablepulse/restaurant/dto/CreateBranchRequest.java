package com.tablepulse.restaurant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateBranchRequest {

    @NotBlank(message = "Branch name is required")
    @Size(max = 100)
    private String name;

    private String address;

    @Size(max = 20)
    private String phone;

    /** HH:mm, e.g. "11:00" */
    private String openingTime;

    /** HH:mm, e.g. "23:00" */
    private String closingTime;
}
