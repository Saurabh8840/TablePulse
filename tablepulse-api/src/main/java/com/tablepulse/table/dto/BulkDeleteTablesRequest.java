package com.tablepulse.table.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class BulkDeleteTablesRequest {

    @NotEmpty(message = "Select at least one table")
    private List<UUID> tableIds;
}
