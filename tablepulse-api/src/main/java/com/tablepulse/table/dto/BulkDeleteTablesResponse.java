package com.tablepulse.table.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class BulkDeleteTablesResponse {

    private List<String> deleted;
    private List<BlockedTable> blocked;

    @Data
    @AllArgsConstructor
    public static class BlockedTable {
        private String tableNumber;
        private String reason;
    }
}
