package com.tablepulse.table;

import com.tablepulse.common.dto.ApiResponse;
import com.tablepulse.table.dto.AssignWaiterRequest;
import com.tablepulse.table.dto.BulkCreateTablesRequest;
import com.tablepulse.table.dto.BulkDeleteTablesRequest;
import com.tablepulse.table.dto.BulkDeleteTablesResponse;
import com.tablepulse.table.dto.CreateTableRequest;
import com.tablepulse.table.dto.TableResponse;
import com.tablepulse.table.dto.UpdateTableRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class TableController {

    private final TableService service;

    public TableController(TableService service) {
        this.service = service;
    }

    @PostMapping("/branches/{id}/tables")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<TableResponse> create(@PathVariable UUID id,
                                             @Valid @RequestBody CreateTableRequest req) {
        return ApiResponse.ok("Table created", service.createTable(id, req));
    }

    @PostMapping("/branches/{id}/tables/bulk")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<List<TableResponse>> bulk(@PathVariable UUID id,
                                                 @Valid @RequestBody BulkCreateTablesRequest req) {
        List<TableResponse> created = service.bulkCreate(id, req);
        return ApiResponse.ok("Created " + created.size() + " tables", created);
    }

    @GetMapping("/branches/{id}/tables")
    public ApiResponse<List<TableResponse>> list(@PathVariable UUID id) {
        return ApiResponse.ok("Tables fetched", service.listTables(id));
    }

    @PutMapping("/tables/{id}")
    public ApiResponse<TableResponse> update(@PathVariable UUID id,
                                             @Valid @RequestBody UpdateTableRequest req) {
        return ApiResponse.ok("Table updated", service.updateTable(id, req));
    }

    @PutMapping("/tables/{id}/assignment")
    public ApiResponse<TableResponse> assign(@PathVariable UUID id,
                                             @Valid @RequestBody AssignWaiterRequest req) {
        return ApiResponse.ok("Waiter assigned", service.assignWaiter(id, req));
    }

    @PostMapping("/branches/{id}/tables/bulk-delete")
    public ApiResponse<BulkDeleteTablesResponse> bulkDelete(@PathVariable UUID id,
                                                            @Valid @RequestBody BulkDeleteTablesRequest req) {
        BulkDeleteTablesResponse res = service.bulkDelete(id, req);
        return ApiResponse.ok("Deleted " + res.getDeleted().size() + " table(s)", res);
    }

    @DeleteMapping("/tables/{id}")
    public ApiResponse<Void> deactivate(@PathVariable UUID id) {
        service.deactivateTable(id);
        return ApiResponse.ok("Table deactivated", null);
    }

    @GetMapping(value = "/tables/{id}/qr-code", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> qrCode(@PathVariable UUID id) {
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .body(service.qrPng(id));
    }
}
