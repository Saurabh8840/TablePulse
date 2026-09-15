package com.tablepulse.table.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class BulkCreateTablesRequest {

    @NotBlank(message = "Prefix is required, e.g. T")
    @Size(max = 6)
    private String prefix = "T";

    @Min(value = 1, message = "from must be at least 1")
    private int from = 1;

    @Min(value = 1, message = "to must be at least 1")
    private int to = 20;

    @Min(value = 1, message = "Seating capacity must be at least 1")
    private int seatingCapacity = 4;
}
