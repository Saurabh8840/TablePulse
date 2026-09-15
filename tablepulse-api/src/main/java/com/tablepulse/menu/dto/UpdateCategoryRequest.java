package com.tablepulse.menu.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateCategoryRequest {

    @Size(max = 50)
    private String name;

    @Size(max = 255)
    private String description;

    @Min(0)
    private Integer displayOrder;

    private Boolean active;
}
