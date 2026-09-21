package com.tablepulse.analytics;

import com.tablepulse.analytics.dto.AnalyticsDtos.DashboardSummary;
import com.tablepulse.analytics.dto.AnalyticsDtos.RevenueMonth;
import com.tablepulse.analytics.dto.AnalyticsDtos.RevenuePoint;import com.tablepulse.analytics.dto.AnalyticsDtos.TopItem;
import com.tablepulse.auth.Tenant;
import com.tablepulse.auth.TenantContext;
import com.tablepulse.common.security.RoleGuard;
import com.tablepulse.common.security.TenantGuard;
import com.tablepulse.order.Order;
import com.tablepulse.order.OrderItem;
import com.tablepulse.order.OrderItemRepository;
import com.tablepulse.order.OrderRepository;
import com.tablepulse.order.OrderService;
import com.tablepulse.order.OrderStatus;
import com.tablepulse.order.TableSession;
import com.tablepulse.order.TableSessionRepository;
import com.tablepulse.payment.Payment;
import com.tablepulse.payment.PaymentMethod;
import com.tablepulse.payment.PaymentRepository;
import com.tablepulse.payment.PaymentStatus;
import com.tablepulse.restaurant.Branch;
import com.tablepulse.restaurant.Restaurant;
import com.tablepulse.restaurant.RestaurantRepository;
import com.tablepulse.restaurant.BranchRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * DB-free unit tests for analytics aggregates.
 */
@ExtendWith(MockitoExtension.class)
class AnalyticsServiceTest {

    @Mock
    private RestaurantRepository restaurants;
    @Mock
    private BranchRepository branches;
    @Mock
    private TableSessionRepository sessions;
    @Mock
    private OrderRepository orders;
    @Mock
    private OrderItemRepository orderItems;
    @Mock
    private PaymentRepository payments;
    @Mock
    private OrderService orderService;
    @Mock
    private TenantGuard guard;
    @Mock
    private RoleGuard roles;

    private AnalyticsService service;
    private UUID tenantId;
    private UUID branchId;
    private Restaurant restaurant;
    private Branch branch;

    @BeforeEach
    void setUp() {
        service = new AnalyticsService(restaurants, branches, sessions, orders,
                orderItems, payments, orderService, guard, roles);
        tenantId = UUID.randomUUID();
        TenantContext.set(tenantId);
        doNothing().when(roles).requireOwnerOrManager();
        Tenant tenant = Tenant.builder().id(tenantId).name("Zen Foods").slug("zen-foods").build();
        restaurant = Restaurant.builder()
                .id(UUID.randomUUID()).tenant(tenant).name("Cafe Zen").slug("cafe-zen").build();
        branchId = UUID.randomUUID();
        branch = Branch.builder().id(branchId).restaurant(restaurant).name("Koramangala").active(true).build();
        lenient().when(restaurants.findByTenantIdOrderByCreatedAtDesc(tenantId)).thenReturn(List.of(restaurant));
        lenient().when(branches.findByRestaurantIdOrderByCreatedAt(restaurant.getId())).thenReturn(List.of(branch));
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    private Payment payment(String total, PaymentStatus status) {
        return Payment.builder()
                .id(UUID.randomUUID()).totalAmount(new BigDecimal(total))
                .paymentMethod(PaymentMethod.MOCK_UPI).status(status).build();
    }

    private Order order(OrderStatus status, Instant placedAt, Instant readyAt) {
        return Order.builder()
                .id(UUID.randomUUID()).orderNumber("ORD-1").status(status)
                .subtotal(new BigDecimal("498.00")).taxAmount(new BigDecimal("24.90"))
                .totalAmount(new BigDecimal("522.90"))
                .placedAt(placedAt).readyAt(readyAt).build();
    }

    @Test
    void dashboardAggregatesRevenueOrdersTablesAndPrep() {
        Instant placed = Instant.now().minusSeconds(3600);
        Instant ready = placed.plusSeconds(1800);
        when(payments.search(eq(tenantId), eq(branchId), any(), any()))
                .thenReturn(List.of(
                        payment("100.00", PaymentStatus.COMPLETED),
                        payment("50.00", PaymentStatus.COMPLETED),
                        payment("999.00", PaymentStatus.PENDING)));
        when(orders.search(eq(tenantId), eq(branchId), eq(null), any(), any()))
                .thenReturn(List.of(
                        order(OrderStatus.SERVED, placed, ready),
                        order(OrderStatus.PLACED, placed, null)));
        when(sessions.findByTable_Branch_IdAndStatus(branchId, "ACTIVE"))
                .thenReturn(List.of(
                        TableSession.builder().id(UUID.randomUUID()).build(),
                        TableSession.builder().id(UUID.randomUUID()).build(),
                        TableSession.builder().id(UUID.randomUUID()).build()));

        DashboardSummary res = service.dashboard(null);

        assertThat(res.getTodayRevenue()).isEqualByComparingTo("150.00");
        assertThat(res.getOrdersToday()).isEqualTo(2);
        assertThat(res.getActiveTables()).isEqualTo(3);
        assertThat(res.getAvgPrepMinutes()).isEqualTo(30.0);
        assertThat(res.getTodayOrderValue()).isEqualByComparingTo("1045.80");
    }

    @Test
    void dashboardOrderValueExcludesCancelled() {
        Order served = order(OrderStatus.SERVED, Instant.now(), Instant.now());
        served.setTotalAmount(new BigDecimal("522.90"));
        Order cancelled = order(OrderStatus.CANCELLED, Instant.now(), null);
        cancelled.setTotalAmount(new BigDecimal("522.90"));
        when(payments.search(eq(tenantId), eq(branchId), any(), any())).thenReturn(List.of());
        when(orders.search(eq(tenantId), eq(branchId), eq(null), any(), any()))
                .thenReturn(List.of(served, cancelled));
        when(sessions.findByTable_Branch_IdAndStatus(branchId, "ACTIVE")).thenReturn(List.of());

        DashboardSummary res = service.dashboard(null);

        assertThat(res.getOrdersToday()).isEqualTo(2);
        assertThat(res.getTodayOrderValue()).isEqualByComparingTo("522.90");
    }

    @Test
    void dashboardEmptyDayReturnsZeros() {
        when(payments.search(eq(tenantId), eq(branchId), any(), any())).thenReturn(List.of());
        when(orders.search(eq(tenantId), eq(branchId), eq(null), any(), any())).thenReturn(List.of());
        when(sessions.findByTable_Branch_IdAndStatus(branchId, "ACTIVE")).thenReturn(List.of());

        DashboardSummary res = service.dashboard(null);

        assertThat(res.getTodayRevenue()).isEqualByComparingTo("0");
        assertThat(res.getOrdersToday()).isZero();
        assertThat(res.getActiveTables()).isZero();
        assertThat(res.getAvgPrepMinutes()).isNull();
    }

    @Test
    void dashboardScopedToRestaurantStaysInsideOutlet() {
        when(guard.restaurant(restaurant.getId())).thenReturn(restaurant);
        when(payments.search(eq(tenantId), eq(branchId), any(), any()))
                .thenReturn(List.of(payment("100.00", PaymentStatus.COMPLETED)));
        when(orders.search(eq(tenantId), eq(branchId), eq(null), any(), any()))
                .thenReturn(List.of(order(OrderStatus.SERVED, Instant.now(), Instant.now())));
        when(sessions.findByTable_Branch_IdAndStatus(branchId, "ACTIVE")).thenReturn(List.of());

        DashboardSummary res = service.dashboard(null, restaurant.getId());

        assertThat(res.getTodayRevenue()).isEqualByComparingTo("100.00");
        assertThat(res.getOrdersToday()).isEqualTo(1);
        verify(guard).restaurant(restaurant.getId());
    }

    @Test
    void restaurantSummariesReturnOneRowPerOutlet() {
        when(payments.search(eq(tenantId), eq(branchId), any(), any()))
                .thenReturn(List.of(payment("200.00", PaymentStatus.COMPLETED)));
        when(orders.search(eq(tenantId), eq(branchId), eq(null), any(), any()))
                .thenReturn(List.of(order(OrderStatus.SERVED, Instant.now(), Instant.now())));
        when(sessions.findByTable_Branch_IdAndStatus(branchId, "ACTIVE")).thenReturn(List.of());

        var res = service.restaurantSummaries();

        assertThat(res).hasSize(1);
        assertThat(res.get(0).getRestaurantId()).isEqualTo(restaurant.getId());
        assertThat(res.get(0).getName()).isEqualTo("Cafe Zen");
        assertThat(res.get(0).getBranchCount()).isEqualTo(1);
        assertThat(res.get(0).getTodayRevenue()).isEqualByComparingTo("200.00");
        assertThat(res.get(0).getOrdersToday()).isEqualTo(1);
        assertThat(res.get(0).getActiveTables()).isZero();
        assertThat(res.get(0).getBalanceDue()).isEqualByComparingTo("0");
    }

    @Test
    void restaurantSummariesIncludeDuesFromActiveSessions() {
        when(payments.search(eq(tenantId), eq(branchId), any(), any())).thenReturn(List.of());
        when(orders.search(eq(tenantId), eq(branchId), eq(null), any(), any())).thenReturn(List.of());
        TableSession active = TableSession.builder().id(UUID.randomUUID()).sessionToken("tok9").build();
        when(sessions.findByTable_Branch_IdAndStatus(branchId, "ACTIVE")).thenReturn(List.of(active));
        when(orderService.bill("tok9")).thenReturn(new com.tablepulse.order.dto.OrderViews.BillResponse(
                "T1", List.of(), new BigDecimal("100.00"), new BigDecimal("5.00"),
                BigDecimal.ZERO, new BigDecimal("105.00"),
                new BigDecimal("65.00"), new BigDecimal("40.00"), "PARTIAL"));

        var res = service.restaurantSummaries();

        assertThat(res).hasSize(1);
        assertThat(res.get(0).getActiveTables()).isEqualTo(1);
        assertThat(res.get(0).getBalanceDue()).isEqualByComparingTo("40.00");
    }

    @Test
    void revenueReturnsSevenDailyPoints() {
        when(payments.search(eq(tenantId), eq(branchId), any(), any()))
                .thenReturn(List.of(payment("10.00", PaymentStatus.COMPLETED)));
        when(orders.search(eq(tenantId), eq(branchId), eq(null), any(), any()))
                .thenReturn(List.of(order(OrderStatus.SERVED, Instant.now(), Instant.now())));

        List<RevenuePoint> points = service.revenue("week", null);

        assertThat(points).hasSize(7);
        assertThat(points.get(6).getDate())
                .isEqualTo(LocalDate.now(ZoneId.of("Asia/Kolkata")).toString());
        assertThat(points).allSatisfy(p -> {
            assertThat(p.getRevenue()).isEqualByComparingTo("10.00");
            assertThat(p.getOrders()).isEqualTo(1);
            assertThat(p.getOrderValue()).isEqualByComparingTo("522.90");
        });
    }

    @Test
    void revenueRejectsUnknownPeriod() {
        assertThatThrownBy(() -> service.revenue("fortnight", null))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void revenueMonthReturnsThirtyDailyPoints() {
        when(payments.search(eq(tenantId), eq(branchId), any(), any())).thenReturn(List.of());
        when(orders.search(eq(tenantId), eq(branchId), eq(null), any(), any())).thenReturn(List.of());

        List<RevenuePoint> points = service.revenuePoints("month", null, null);

        assertThat(points).hasSize(30);
        assertThat(points.get(29).getDate())
                .isEqualTo(LocalDate.now(ZoneId.of("Asia/Kolkata")).toString());
    }

    @Test
    void revenueArbitraryMonthReturnsItsDays() {
        when(payments.search(eq(tenantId), eq(branchId), any(), any())).thenReturn(List.of());
        when(orders.search(eq(tenantId), eq(branchId), eq(null), any(), any())).thenReturn(List.of());

        List<RevenuePoint> points = service.revenuePoints("month", null, "2026-01");

        assertThat(points).hasSize(31);
        assertThat(points.get(0).getDate()).isEqualTo("2026-01-01");
        assertThat(points.get(30).getDate()).isEqualTo("2026-01-31");
    }

    @Test
    void revenueRejectsBadAndFutureMonth() {
        assertThatThrownBy(() -> service.revenuePoints("month", null, "jan-2026"))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        String future = java.time.YearMonth.now(ZoneId.of("Asia/Kolkata")).plusMonths(1).toString();
        assertThatThrownBy(() -> service.revenuePoints("month", null, future))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void revenueByMonthReturnsTwelveAscendingPoints() {
        when(payments.search(eq(tenantId), eq(branchId), any(), any())).thenReturn(List.of());
        when(orders.search(eq(tenantId), eq(branchId), eq(null), any(), any())).thenReturn(List.of());

        List<RevenueMonth> months = service.revenueByMonth(null);

        assertThat(months).hasSize(12);
        assertThat(months.get(11).getMonth())
                .isEqualTo(java.time.YearMonth.now(ZoneId.of("Asia/Kolkata")).toString());
        assertThat(months.stream().map(m -> m.getMonth()).toList())
                .isSorted();
    }

    @Test
    void dashboardCountsCompletedPayments() {
        when(payments.search(eq(tenantId), eq(branchId), any(), any()))
                .thenReturn(List.of(
                        payment("100.00", PaymentStatus.COMPLETED),
                        payment("50.00", PaymentStatus.PENDING)));
        when(orders.search(eq(tenantId), eq(branchId), eq(null), any(), any())).thenReturn(List.of());
        when(sessions.findByTable_Branch_IdAndStatus(branchId, "ACTIVE")).thenReturn(List.of());

        DashboardSummary res = service.dashboard(null);

        assertThat(res.getTodayRevenue()).isEqualByComparingTo("100.00");
        assertThat(res.getPaymentsToday()).isEqualTo(1);
    }

    @Test
    @SuppressWarnings("unchecked")
    void topItemsGroupsSortsAndExcludesCancelled() {
        Order served1 = order(OrderStatus.SERVED, Instant.now(), Instant.now());
        Order served2 = order(OrderStatus.SERVED, Instant.now(), Instant.now());
        Order cancelled = order(OrderStatus.CANCELLED, Instant.now(), null);
        when(orders.search(eq(tenantId), eq(branchId), eq(null), any(), any()))
                .thenReturn(List.of(served1, served2, cancelled));
        ArgumentCaptor<List<UUID>> idsCaptor = ArgumentCaptor.forClass(List.class);
        when(orderItems.findByOrderIdIn(idsCaptor.capture())).thenReturn(List.of(
                OrderItem.builder().menuItemName("Singapore Noodles").quantity(2)
                        .totalPrice(new BigDecimal("498.00")).build(),
                OrderItem.builder().menuItemName("Singapore Noodles").quantity(1)
                        .totalPrice(new BigDecimal("249.00")).build(),
                OrderItem.builder().menuItemName("Iced Tea").quantity(1)
                        .totalPrice(new BigDecimal("50.00")).build()));

        List<TopItem> top = service.topItems(5, null, null);

        assertThat(idsCaptor.getValue())
                .contains(served1.getId(), served2.getId())
                .doesNotContain(cancelled.getId());
        assertThat(top).hasSize(2);
        assertThat(top.get(0).getName()).isEqualTo("Singapore Noodles");
        assertThat(top.get(0).getQuantity()).isEqualTo(3);
        assertThat(top.get(0).getRevenue()).isEqualByComparingTo("747.00");
        assertThat(top.get(1).getName()).isEqualTo("Iced Tea");
    }

    @Test
    void topItemsEmptyWhenNoOrders() {
        when(orders.search(eq(tenantId), eq(branchId), eq(null), any(), any())).thenReturn(List.of());

        assertThat(service.topItems(5, null, null)).isEmpty();
    }

    @Test
    void topItemsRejectsBadLimit() {
        assertThatThrownBy(() -> service.topItems(0, null, null))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void topItemsRejectsBadDate() {
        assertThatThrownBy(() -> service.topItems(5, null, "not-a-date"))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void dashboardUsesBranchGuardWhenScoped() {
        when(guard.branch(branchId)).thenReturn(branch);
        when(payments.search(eq(tenantId), eq(branchId), any(), any())).thenReturn(List.of());
        when(orders.search(eq(tenantId), eq(branchId), eq(null), any(), any())).thenReturn(List.of());
        when(sessions.findByTable_Branch_IdAndStatus(branchId, "ACTIVE")).thenReturn(List.of());

        DashboardSummary res = service.dashboard(branchId);

        verify(guard).branch(branchId);
        assertThat(res.getOrdersToday()).isZero();
    }
}
