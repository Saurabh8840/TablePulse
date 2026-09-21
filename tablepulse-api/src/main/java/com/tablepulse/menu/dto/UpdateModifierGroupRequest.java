package com.tablepulse.menu.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateModifierGroupRequest {

    @Size(max = 50)
    private String name;

    private Boolean required;

    @Min(0)
    private Integer minSelections;

    @Min(1)
    @Max(20)
    private Integer maxSelections;

    @Min(0)
    private Integer displayOrder;
}
