package com.tablepulse.analytics;

import com.tablepulse.analytics.dto.AnalyticsDtos.DashboardSummary;
import com.tablepulse.analytics.dto.AnalyticsDtos.RevenueMonth;
import com.tablepulse.analytics.dto.AnalyticsDtos.RevenuePoint;
import com.tablepulse.analytics.dto.AnalyticsDtos.TopItem;
import com.tablepulse.common.security.RoleGuard;
import com.tablepulse.common.security.TenantGuard;
import com.tablepulse.order.Order;
import com.tablepulse.order.OrderItem;
import com.tablepulse.order.OrderItemRepository;
import com.tablepulse.order.OrderRepository;
import com.tablepulse.order.OrderStatus;
import com.tablepulse.order.TableSessionRepository;
import com.tablepulse.payment.Payment;
import com.tablepulse.payment.PaymentRepository;
import com.tablepulse.payment.PaymentStatus;
import com.tablepulse.restaurant.Branch;
import com.tablepulse.restaurant.BranchRepository;
import com.tablepulse.restaurant.RestaurantRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Phase 7 — read-only operational metrics for owners/managers.
 * Revenue counts COMPLETED payments by creation day (consistent with
 * GET /api/payments which filters on created_at). No migration needed.
 */
@Service
public class AnalyticsService {

    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");
    private static final Set<OrderStatus> BILLABLE_EXCLUDED = Set.of(OrderStatus.CANCELLED, OrderStatus.REJECTED);

    private final RestaurantRepository restaurants;
    private final BranchRepository branches;
    private final TableSessionRepository sessions;
    private final OrderRepository orders;
    private final OrderItemRepository orderItems;
    private final PaymentRepository payments;
    private final TenantGuard guard;
    private final RoleGuard roles;

    public AnalyticsService(RestaurantRepository restaurants, BranchRepository branches,
                            TableSessionRepository sessions, OrderRepository orders,
                            OrderItemRepository orderItems, PaymentRepository payments,
                            TenantGuard guard, RoleGuard roles) {
        this.restaurants = restaurants;
        this.branches = branches;
        this.sessions = sessions;
        this.orders = orders;
        this.orderItems = orderItems;
        this.payments = payments;
        this.guard = guard;
        this.roles = roles;
    }

    @Transactional(readOnly = true)
    public DashboardSummary dashboard(UUID branchId) {
        roles.requireOwnerOrManager();
        List<UUID> branchIds = resolveBranches(branchId);
        UUID tenantId = TenantGuard.tenantId();
        LocalDate today = LocalDate.now(ZONE);
        Instant from = today.atStartOfDay(ZONE).toInstant();
        Instant to = today.plusDays(1).atStartOfDay(ZONE).toInstant();

        BigDecimal revenue = BigDecimal.ZERO;
        long orderCount = 0;
        long paymentCount = 0;
        BigDecimal orderValue = BigDecimal.ZERO;
        List<Order> todayOrders = new ArrayList<>();
        for (UUID b : branchIds) {
            for (Payment p : payments.search(tenantId, b, from, to)) {
                if (p.getStatus() == PaymentStatus.COMPLETED && p.getTotalAmount() != null) {
                    revenue = revenue.add(p.getTotalAmount());
                    paymentCount++;
                }
            }
            List<Order> placed = orders.search(tenantId, b, null, from, to);
            orderCount += placed.size();
            todayOrders.addAll(placed);
            for (Order o : placed) {
                if (!BILLABLE_EXCLUDED.contains(o.getStatus()) && o.getTotalAmount() != null) {
                    orderValue = orderValue.add(o.getTotalAmount());
                }
            }
        }

        long activeTables = 0;
        for (UUID b : branchIds) {
            activeTables += sessions.findByTable_Branch_IdAndStatus(b, "ACTIVE").size();
        }

        Double avgPrep = null;
        List<Long> prepMinutes = new ArrayList<>();
        for (Order o : todayOrders) {
            if (o.getPlacedAt() != null && o.getReadyAt() != null) {
                prepMinutes.add(Duration.between(o.getPlacedAt(), o.getReadyAt()).toMinutes());
            }
        }
        if (!prepMinutes.isEmpty()) {
            avgPrep = Math.round(prepMinutes.stream().mapToLong(Long::longValue).average().orElse(0) * 10.0) / 10.0;
        }

        return new DashboardSummary(revenue, orderCount, activeTables, avgPrep, paymentCount, orderValue);
    }

    @Transactional(readOnly = true)
    public List<RevenuePoint> revenuePoints(String period, UUID branchId, String month) {
        roles.requireOwnerOrManager();
        String p = period == null || period.isBlank() ? "week" : period.trim().toLowerCase();
        if (!p.equals("week") && !p.equals("month")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "period must be week or month");
        }
        List<UUID> branchIds = resolveBranches(branchId);
        UUID tenantId = TenantGuard.tenantId();

        List<LocalDate> days = new ArrayList<>();
        if (month != null && !month.isBlank()) {
            YearMonth ym = parseMonth(month);
            for (int d = 1; d <= ym.lengthOfMonth(); d++) {
                days.add(ym.atDay(d));
            }
        } else {
            int size = p.equals("week") ? 7 : 30;
            LocalDate today = LocalDate.now(ZONE);
            for (int i = size - 1; i >= 0; i--) {
                days.add(today.minusDays(i));
            }
        }
        List<RevenuePoint> out = new ArrayList<>();
        for (LocalDate day : days) {
            Instant from = day.atStartOfDay(ZONE).toInstant();
            Instant to = day.plusDays(1).atStartOfDay(ZONE).toInstant();
            Bucket bucket = bucket(tenantId, branchIds, from, to);
            out.add(new RevenuePoint(day.toString(), bucket.revenue(), bucket.orders(), bucket.orderValue()));
        }
        return out;
    }

    @Transactional(readOnly = true)
    public List<RevenueMonth> revenueByMonth(UUID branchId) {
        roles.requireOwnerOrManager();
        List<UUID> branchIds = resolveBranches(branchId);
        UUID tenantId = TenantGuard.tenantId();
        List<RevenueMonth> out = new ArrayList<>();
        YearMonth current = YearMonth.now(ZONE);
        for (int i = 11; i >= 0; i--) {
            YearMonth ym = current.minusMonths(i);
            Instant from = ym.atDay(1).atStartOfDay(ZONE).toInstant();
            Instant to = ym.plusMonths(1).atDay(1).atStartOfDay(ZONE).toInstant();
            Bucket bucket = bucket(tenantId, branchIds, from, to);
            out.add(new RevenueMonth(ym.toString(), bucket.revenue(), bucket.orders(), bucket.orderValue()));
        }
        return out;
    }

    /** Backwards-compatible overload (week). */
    @Transactional(readOnly = true)
    public List<RevenuePoint> revenue(String period, UUID branchId) {
        return revenuePoints(period, branchId, null);
    }

    private record Bucket(BigDecimal revenue, long orders, BigDecimal orderValue) {
    }

    private Bucket bucket(UUID tenantId, List<UUID> branchIds, Instant from, Instant to) {
        BigDecimal revenue = BigDecimal.ZERO;
        long orderCount = 0;
        BigDecimal orderValue = BigDecimal.ZERO;
        for (UUID b : branchIds) {
            for (Payment p : payments.search(tenantId, b, from, to)) {
                if (p.getStatus() == PaymentStatus.COMPLETED && p.getTotalAmount() != null) {
                    revenue = revenue.add(p.getTotalAmount());
                }
            }
            List<Order> placed = orders.search(tenantId, b, null, from, to);
            orderCount += placed.size();
            for (Order o : placed) {
                if (!BILLABLE_EXCLUDED.contains(o.getStatus()) && o.getTotalAmount() != null) {
                    orderValue = orderValue.add(o.getTotalAmount());
                }
            }
        }
        return new Bucket(revenue, orderCount, orderValue);
    }

    private YearMonth parseMonth(String month) {
        final YearMonth ym;
        try {
            ym = YearMonth.parse(month.trim());
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "month must be YYYY-MM");
        }
        if (ym.isAfter(YearMonth.now(ZONE))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "month must not be in the future");
        }
        return ym;
    }

    @Transactional(readOnly = true)
    public List<TopItem> topItems(int limit, UUID branchId, String date) {
        roles.requireOwnerOrManager();
        if (limit < 1 || limit > 50) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "limit must be 1-50");
        }
        List<UUID> branchIds = resolveBranches(branchId);
        UUID tenantId = TenantGuard.tenantId();
        LocalDate day = parseDateOrToday(date);
        Instant from = day.atStartOfDay(ZONE).toInstant();
        Instant to = day.plusDays(1).atStartOfDay(ZONE).toInstant();

        List<UUID> orderIds = new ArrayList<>();
        for (UUID b : branchIds) {
            for (Order o : orders.search(tenantId, b, null, from, to)) {
                if (!BILLABLE_EXCLUDED.contains(o.getStatus())) {
                    orderIds.add(o.getId());
                }
            }
        }
        if (orderIds.isEmpty()) {
            return List.of();
        }

        Map<String, long[]> qtyByName = new HashMap<>();
        Map<String, BigDecimal> revenueByName = new HashMap<>();
        for (OrderItem item : orderItems.findByOrderIdIn(orderIds)) {
            String name = item.getMenuItemName();
            qtyByName.computeIfAbsent(name, k -> new long[1])[0] += item.getQuantity();
            revenueByName.merge(name,
                    item.getTotalPrice() != null ? item.getTotalPrice() : BigDecimal.ZERO,
                    BigDecimal::add);
        }

        return qtyByName.entrySet().stream()
                .map(e -> new TopItem(e.getKey(), e.getValue()[0],
                        revenueByName.getOrDefault(e.getKey(), BigDecimal.ZERO)))
                .sorted(Comparator.comparingLong(TopItem::getQuantity).reversed())
                .limit(limit)
                .toList();
    }

    // ---------- internals ----------

    private List<UUID> resolveBranches(UUID branchId) {
        // Outlet-pinned staff are confined to home even when they pass nothing —
        // an explicit foreign branchId 404s inside guard.branch.
        if (branchId == null) {
            var home = guard.homeBranch();
            if (home.isPresent()) {
                branchId = home.get().getId();
            }
        }
        if (branchId != null) {
            guard.branch(branchId);
            return List.of(branchId);
        }
        UUID tenantId = TenantGuard.tenantId();
        List<UUID> out = new ArrayList<>();
        restaurants.findByTenantIdOrderByCreatedAtDesc(tenantId).forEach(r ->
                branches.findByRestaurantIdOrderByCreatedAt(r.getId()).stream()
                        .filter(Branch::isActive)
                        .map(Branch::getId)
                        .forEach(out::add));
        return out;
    }

    private LocalDate parseDateOrToday(String date) {
        if (date == null || date.isBlank()) {
            return LocalDate.now(ZONE);
        }
        try {
            return LocalDate.parse(date.trim());
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Date must be YYYY-MM-DD");
        }
    }
}
