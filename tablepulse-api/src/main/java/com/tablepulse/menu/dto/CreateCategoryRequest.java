package com.tablepulse.menu.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateCategoryRequest {

    @NotBlank(message = "Category name is required")
    @Size(max = 50)
    private String name;

    @Size(max = 255)
    private String description;

    @Min(0)
    private int displayOrder = 0;
}
