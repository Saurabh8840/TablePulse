package com.tablepulse.table;

import com.tablepulse.auth.Role;
import com.tablepulse.auth.User;
import com.tablepulse.auth.UserRepository;
import com.tablepulse.common.security.RoleGuard;
import com.tablepulse.common.security.TenantGuard;
import com.tablepulse.order.TableSessionRepository;
import com.tablepulse.restaurant.Branch;
import com.tablepulse.table.dto.AssignWaiterRequest;
import com.tablepulse.table.dto.BulkCreateTablesRequest;
import com.tablepulse.table.dto.BulkDeleteTablesRequest;
import com.tablepulse.table.dto.BulkDeleteTablesResponse;
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
    private final RoleGuard roles;
    private final UserRepository users;
    private final TableSessionRepository sessions;
    private final QrCodeService qrCodes;
    private final String publicBaseUrl;

    public TableService(RestaurantTableRepository tables, TenantGuard guard, RoleGuard roles,
                        UserRepository users, TableSessionRepository sessions, QrCodeService qrCodes,
                        @Value("${app.public-base-url:https://tablepulse.in}") String publicBaseUrl) {
        this.tables = tables;
        this.guard = guard;
        this.roles = roles;
        this.users = users;
        this.sessions = sessions;
        this.qrCodes = qrCodes;
        this.publicBaseUrl = publicBaseUrl;
    }

    @Transactional
    public TableResponse createTable(UUID branchId, CreateTableRequest req) {
        roles.requireOwnerOrManager();
        Branch branch = guard.branch(branchId);
        String number = req.getTableNumber().trim();
        if (tables.existsByBranchIdAndTableNumberAndActiveTrue(branchId, number)) {
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
        roles.requireOwnerOrManager();
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
            if (tables.existsByBranchIdAndTableNumberAndActiveTrue(branchId, number)) continue;
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
        roles.requireOwnerOrManager();
        RestaurantTable t = guard.table(tableId);
        if (req.getTableNumber() != null && !req.getTableNumber().isBlank()
                && !req.getTableNumber().trim().equals(t.getTableNumber())) {
            String number = req.getTableNumber().trim();
            if (tables.existsByBranchIdAndTableNumberAndActiveTrue(t.getBranch().getId(), number)) {
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
        roles.requireOwnerOrManager();
        RestaurantTable t = guard.table(tableId);
        requireFree(t);
        t.setActive(false);
        tables.save(t);
    }

    /**
     * Bulk delete for floor shrinks (15 tables → 6). Partial success by design:
     * occupied / foreign tables are reported, the rest are deleted.
     */
    @Transactional
    public BulkDeleteTablesResponse bulkDelete(UUID branchId, BulkDeleteTablesRequest req) {
        roles.requireOwnerOrManager();
        Branch branch = guard.branch(branchId);
        List<String> deleted = new ArrayList<>();
        List<BulkDeleteTablesResponse.BlockedTable> blocked = new ArrayList<>();
        for (UUID tableId : req.getTableIds()) {
            RestaurantTable t;
            try {
                t = guard.table(tableId);
            } catch (ResponseStatusException ex) {
                blocked.add(new BulkDeleteTablesResponse.BlockedTable("?", "Table not found"));
                continue;
            }
            if (!t.getBranch().getId().equals(branch.getId())) {
                blocked.add(new BulkDeleteTablesResponse.BlockedTable(t.getTableNumber(), "Not in this branch"));
                continue;
            }
            if (!t.isActive()) {
                continue;
            }
            try {
                requireFree(t);
            } catch (ResponseStatusException ex) {
                blocked.add(new BulkDeleteTablesResponse.BlockedTable(t.getTableNumber(), ex.getReason()));
                continue;
            }
            t.setActive(false);
            tables.save(t);
            deleted.add(t.getTableNumber());
        }
        return new BulkDeleteTablesResponse(deleted, blocked);
    }

    /** A table with diners seated can't be deleted — close its session first. */
    private void requireFree(RestaurantTable t) {
        if (!sessions.findByTableIdAndStatus(t.getId(), "ACTIVE").isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Table " + t.getTableNumber() + " is occupied — close its session first");
        }
    }

    @Transactional
    public TableResponse assignWaiter(UUID tableId, AssignWaiterRequest req) {
        roles.requireOwnerOrManager();
        RestaurantTable t = guard.table(tableId);
        if (req.getAssignedWaiterId() == null) {
            t.setAssignedWaiter(null);
            return toResponse(tables.save(t));
        }
        User waiter = users.findById(req.getAssignedWaiterId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Waiter not found"));
        if (!waiter.getTenant().getId().equals(t.getBranch().getRestaurant().getTenant().getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Waiter not found");
        }
        if (!waiter.isActive() || waiter.getRole() != Role.WAITER) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tables can only be assigned to an active waiter");
        }
        t.setAssignedWaiter(waiter);
        return toResponse(tables.save(t));
    }

    @Transactional(readOnly = true)
    public byte[] qrPng(UUID tableId) {
        roles.requireOwnerOrManager();
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
                t.getSeatingCapacity(), t.getStatus(), t.getQrCodeUrl(), t.isActive(),
                t.getAssignedWaiter() != null ? t.getAssignedWaiter().getId() : null,
                t.getAssignedWaiter() != null ? t.getAssignedWaiter().getFullName() : null);
    }
}
