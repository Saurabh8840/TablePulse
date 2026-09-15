package com.tablepulse.waiter;

import com.tablepulse.auth.User;
import com.tablepulse.auth.UserRepository;
import com.tablepulse.common.security.TenantGuard;
import com.tablepulse.order.Order;
import com.tablepulse.order.OrderRepository;
import com.tablepulse.order.OrderStatus;
import com.tablepulse.order.TableSession;
import com.tablepulse.order.TableSessionRepository;
import com.tablepulse.order.dto.OrderViews.SessionResponse;
import com.tablepulse.table.RestaurantTable;
import com.tablepulse.table.RestaurantTableRepository;
import com.tablepulse.waiter.dto.TableStatusResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Phase 5 — waiter floor view. Combines static tables + active sessions + live orders
 * into one grid payload, and owns the safe "close table" action.
 */
@Service
public class WaiterService {

    /** Orders that keep a table "busy" — SERVED/CANCELLED/REJECTED/COMPLETED don't block close. */
    private static final Set<OrderStatus> BLOCKING =
            EnumSet.of(OrderStatus.PLACED, OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY);

    /** Live orders shown on the floor — everything not terminal. */
    private static final Set<OrderStatus> LIVE = EnumSet.of(
            OrderStatus.PLACED, OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY);

    private final RestaurantTableRepository tables;
    private final TableSessionRepository sessions;
    private final OrderRepository orders;
    private final UserRepository users;
    private final TenantGuard guard;

    public WaiterService(RestaurantTableRepository tables, TableSessionRepository sessions,
                         OrderRepository orders, UserRepository users, TenantGuard guard) {
        this.tables = tables;
        this.sessions = sessions;
        this.orders = orders;
        this.users = users;
        this.guard = guard;
    }

    @Transactional(readOnly = true)
    public List<TableStatusResponse> tableStatus(UUID branchId) {
        guard.branch(branchId);
        UUID tenantId = TenantGuard.tenantId();

        List<RestaurantTable> all = tables.findByBranchIdOrderByTableNumber(branchId);

        Map<UUID, TableSession> sessionByTable = new HashMap<>();
        for (TableSession s : sessions.findByTable_Branch_IdAndStatus(branchId, "ACTIVE")) {
            sessionByTable.putIfAbsent(s.getTable().getId(), s);
        }

        Map<UUID, List<Order>> liveByTable = new HashMap<>();
        for (Order o : orders.search(tenantId, branchId, null, null, null)) {
            if (!LIVE.contains(o.getStatus())) continue;
            if (!"ACTIVE".equals(o.getSession().getStatus())) continue;
            liveByTable.computeIfAbsent(o.getTable().getId(), k -> new ArrayList<>()).add(o);
            // Backfill session map in case the session query missed (same branch, tenant-checked).
            sessionByTable.putIfAbsent(o.getTable().getId(), o.getSession());
        }

        List<TableStatusResponse> out = new ArrayList<>();
        for (RestaurantTable t : all) {
            if (!t.isActive()) continue;
            TableSession s = sessionByTable.get(t.getId());
            List<Order> live = liveByTable.getOrDefault(t.getId(), List.of());

            int ready = 0;
            boolean hasPlaced = false;
            boolean hasPreparing = false;
            Instant oldest = null;
            for (Order o : live) {
                if (o.getStatus() == OrderStatus.READY) ready++;
                if (o.getStatus() == OrderStatus.PLACED) hasPlaced = true;
                if (o.getStatus() == OrderStatus.ACCEPTED || o.getStatus() == OrderStatus.PREPARING) {
                    hasPreparing = true;
                }
                if (oldest == null || o.getPlacedAt().isBefore(oldest)) oldest = o.getPlacedAt();
            }

            String display;
            if (s == null && live.isEmpty()) display = "EMPTY";
            else if (ready > 0) display = "READY";
            else if (hasPreparing) display = "PREPARING";
            else if (hasPlaced) display = "ORDERED";
            else display = "OCCUPIED";

            out.add(new TableStatusResponse(t.getId(), t.getTableNumber(), t.getSeatingCapacity(),
                    t.getStatus(), display, s != null ? s.getId() : null,
                    live.size(), ready, oldest,
                    t.getAssignedWaiter() != null ? t.getAssignedWaiter().getId() : null,
                    t.getAssignedWaiter() != null ? t.getAssignedWaiter().getFullName() : null));
        }
        return out;
    }

    @Transactional
    public SessionResponse closeSession(UUID sessionId) {
        requireFloorRole();
        TableSession s = sessions.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));
        // Tenant isolation — 404 if this session belongs to another tenant.
        guard.table(s.getTable().getId());
        if (!"ACTIVE".equals(s.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Session is already closed");
        }
        long blocking = orders.findBySessionIdOrderByPlacedAtAsc(sessionId).stream()
                .filter(o -> BLOCKING.contains(o.getStatus()))
                .count();
        if (blocking > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Table has " + blocking + " open order" + (blocking == 1 ? "" : "s") + " — serve or cancel them first");
        }
        s.setStatus("CLOSED");
        s.setClosedAt(Instant.now());
        s.setClosedBy(currentUser());
        TableSession saved = sessions.save(s);
        return new SessionResponse(saved.getId(), saved.getSessionToken(), saved.getTable().getId(),
                saved.getTable().getTableNumber(), saved.getTable().getBranch().getId(),
                saved.getTable().getBranch().getRestaurant().getSlug(), saved.getStatus(), saved.getStartedAt(),
                saved.getClosedBy() != null ? saved.getClosedBy().getFullName() : null);
    }

    private User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired token");
        }
        return users.findById(UUID.fromString(auth.getName()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired token"));
    }

    private void requireFloorRole() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getAuthorities().stream().noneMatch(a ->
                a.getAuthority().equals("ROLE_WAITER")
                        || a.getAuthority().equals("ROLE_MANAGER")
                        || a.getAuthority().equals("ROLE_OWNER"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only waiter, manager or owner can do this");
        }
    }
}
