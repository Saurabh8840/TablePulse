package com.tablepulse.table.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateTableRequest {

    @NotBlank(message = "Table number is required")
    @Size(max = 10)
    private String tableNumber;

    @Min(value = 1, message = "Seating capacity must be at least 1")
    private int seatingCapacity = 4;
}
