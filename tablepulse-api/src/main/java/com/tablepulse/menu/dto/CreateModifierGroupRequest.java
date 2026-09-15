package com.tablepulse.menu.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateModifierGroupRequest {

    @NotBlank(message = "Group name is required")
    @Size(max = 50)
    private String name;

    private boolean required = false;

    @Min(0)
    private int minSelections = 0;

    @Min(1)
    @Max(20)
    private int maxSelections = 1;

    @Min(0)
    private int displayOrder = 0;
}
