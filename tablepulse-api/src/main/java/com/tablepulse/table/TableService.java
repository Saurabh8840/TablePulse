package com.tablepulse.table;

import com.tablepulse.common.security.TenantGuard;
import com.tablepulse.restaurant.Branch;
import com.tablepulse.table.dto.BulkCreateTablesRequest;
import com.tablepulse.table.dto.CreateTableRequest;
import com.tablepulse.table.dto.TableResponse;
import com.tablepulse.table.dto.UpdateTableRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class TableService {

    private static final Set<String> STATUSES = Set.of("AVAILABLE", "OCCUPIED", "RESERVED");

    private final RestaurantTableRepository tables;
    private final TenantGuard guard;
    private final QrCodeService qrCodes;
    private final String publicBaseUrl;

    public TableService(RestaurantTableRepository tables, TenantGuard guard,
                        QrCodeService qrCodes,
                        @Value("${app.public-base-url:https://tablepulse.in}") String publicBaseUrl) {
        this.tables = tables;
        this.guard = guard;
        this.qrCodes = qrCodes;
        this.publicBaseUrl = publicBaseUrl;
    }

    @Transactional
    public TableResponse createTable(UUID branchId, CreateTableRequest req) {
        Branch branch = guard.branch(branchId);
        String number = req.getTableNumber().trim();
        if (tables.existsByBranchIdAndTableNumber(branchId, number)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Table number already exists in this branch");
        }
        RestaurantTable t = tables.save(RestaurantTable.builder()
                .branch(branch)
                .tableNumber(number)
                .seatingCapacity(req.getSeatingCapacity())
                .status("AVAILABLE")
                .active(true)
                .build());
        t.setQrCodeUrl(qrContent(branch, t));
        return toResponse(tables.save(t));
    }

    @Transactional
    public List<TableResponse> bulkCreate(UUID branchId, BulkCreateTablesRequest req) {
        if (req.getTo() < req.getFrom()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "'to' must be >= 'from'");
        }
        if (req.getTo() - req.getFrom() > 200) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Can create at most 200 tables at once");
        }
        Branch branch = guard.branch(branchId);
        List<TableResponse> created = new ArrayList<>();
        for (int i = req.getFrom(); i <= req.getTo(); i++) {
            String number = req.getPrefix().trim() + i;
            if (tables.existsByBranchIdAndTableNumber(branchId, number)) continue;
            RestaurantTable t = tables.save(RestaurantTable.builder()
                    .branch(branch)
                    .tableNumber(number)
                    .seatingCapacity(req.getSeatingCapacity())
                    .status("AVAILABLE")
                    .active(true)
                    .build());
            t.setQrCodeUrl(qrContent(branch, t));
            created.add(toResponse(tables.save(t)));
        }
        return created;
    }

    @Transactional(readOnly = true)
    public List<TableResponse> listTables(UUID branchId) {
        guard.branch(branchId);
        return tables.findByBranchIdOrderByTableNumber(branchId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public TableResponse updateTable(UUID tableId, UpdateTableRequest req) {
        RestaurantTable t = guard.table(tableId);
        if (req.getTableNumber() != null && !req.getTableNumber().isBlank()
                && !req.getTableNumber().trim().equals(t.getTableNumber())) {
            String number = req.getTableNumber().trim();
            if (tables.existsByBranchIdAndTableNumber(t.getBranch().getId(), number)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Table number already exists in this branch");
            }
            t.setTableNumber(number);
            t.setQrCodeUrl(qrContent(t.getBranch(), t));
        }
        if (req.getSeatingCapacity() != null) t.setSeatingCapacity(req.getSeatingCapacity());
        if (req.getStatus() != null) {
            String s = req.getStatus().trim().toUpperCase();
            if (!STATUSES.contains(s)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status must be AVAILABLE, OCCUPIED or RESERVED");
            }
            t.setStatus(s);
        }
        if (req.getActive() != null) t.setActive(req.getActive());
        return toResponse(tables.save(t));
    }

    @Transactional
    public void deactivateTable(UUID tableId) {
        RestaurantTable t = guard.table(tableId);
        t.setActive(false);
        tables.save(t);
    }

    @Transactional(readOnly = true)
    public byte[] qrPng(UUID tableId) {
        RestaurantTable t = guard.table(tableId);
        return qrCodes.png(t.getQrCodeUrl() != null ? t.getQrCodeUrl() : qrContent(t.getBranch(), t));
    }

    /** Encoded QR payload per PRD: https://tablepulse.in/r/{slug}/t/{table}?b={branchId} */
    private String qrContent(Branch branch, RestaurantTable t) {
        String slug = branch.getRestaurant().getSlug();
        return publicBaseUrl + "/r/" + slug + "/t/" + t.getTableNumber() + "?b=" + branch.getId();
    }

    private TableResponse toResponse(RestaurantTable t) {
        return new TableResponse(t.getId(), t.getBranch().getId(), t.getTableNumber(),
                t.getSeatingCapacity(), t.getStatus(), t.getQrCodeUrl(), t.isActive());
    }
}
