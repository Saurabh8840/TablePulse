package com.tablepulse.waiter;

import com.tablepulse.auth.Tenant;
import com.tablepulse.auth.TenantContext;
import com.tablepulse.auth.User;
import com.tablepulse.auth.UserRepository;
import com.tablepulse.common.security.TenantGuard;
import com.tablepulse.order.Order;
import com.tablepulse.order.OrderRepository;
import com.tablepulse.order.OrderService;
import com.tablepulse.order.OrderStatus;
import com.tablepulse.order.TableSession;
import com.tablepulse.order.TableSessionRepository;
import com.tablepulse.order.dto.OrderViews.BillLine;
import com.tablepulse.order.dto.OrderViews.BillResponse;
import com.tablepulse.order.dto.OrderViews.SessionResponse;
import com.tablepulse.payment.PaymentRepository;
import com.tablepulse.restaurant.Branch;
import com.tablepulse.restaurant.Restaurant;
import com.tablepulse.table.RestaurantTable;
import com.tablepulse.table.RestaurantTableRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Close Table still blocks on kitchen-live orders but settles leftover
 * SERVED rows itself (per-row Complete is convenience, close never strands).
 */
@ExtendWith(MockitoExtension.class)
class WaiterServiceTest {

    @Mock
    private RestaurantTableRepository tables;
    @Mock
    private TableSessionRepository sessions;
    @Mock
    private OrderRepository orders;
    @Mock
    private UserRepository users;
    @Mock
    private TenantGuard guard;
    @Mock
    private OrderService orderService;
    @Mock
    private PaymentRepository payments;

    private WaiterService service;
    private UUID sessionId;
    private TableSession session;
    private RestaurantTable table;
    private User waiter;
    private UUID waiterId;

    @BeforeEach
    void setUp() {
        service = new WaiterService(tables, sessions, orders, users, guard, orderService, payments);
        UUID tenantId = UUID.randomUUID();
        TenantContext.set(tenantId);
        Tenant tenant = Tenant.builder().id(tenantId).name("T").slug("t").build();
        Restaurant restaurant = Restaurant.builder()
                .id(UUID.randomUUID()).tenant(tenant).name("R").slug("r").build();
        Branch branch = Branch.builder().id(UUID.randomUUID()).restaurant(restaurant).name("B").build();
        table = RestaurantTable.builder()
                .id(UUID.randomUUID()).branch(branch).tableNumber("T10").active(true).build();
        sessionId = UUID.randomUUID();
        session = TableSession.builder()
                .id(sessionId).table(table).sessionToken("tok").status("ACTIVE").build();
        waiterId = UUID.randomUUID();
        waiter = User.builder().id(waiterId).tenant(tenant)
                .email("sonu@x.in").fullName("Sonu").build();

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(waiterId.toString(), null,
                        List.of(new SimpleGrantedAuthority("ROLE_WAITER"))));
        when(sessions.findById(sessionId)).thenReturn(Optional.of(session));
        when(guard.table(table.getId())).thenReturn(table);
        lenient().when(users.findById(waiterId)).thenReturn(Optional.of(waiter));
        lenient().when(sessions.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    private Order order(OrderStatus status) {
        return Order.builder()
                .id(UUID.randomUUID()).orderNumber("ORD-1").status(status)
                .session(session).table(table).build();
    }

    @Test
    void closeFlipsLeftoverServedToCompleted() {
        Order served = order(OrderStatus.SERVED);
        when(orders.findBySessionIdOrderByPlacedAtAsc(sessionId)).thenReturn(List.of(served));
        when(orders.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(orderService.bill("tok")).thenReturn(paidBill());

        SessionResponse res = service.closeSession(sessionId);

        assertThat(res.getStatus()).isEqualTo("CLOSED");
        assertThat(served.getStatus()).isEqualTo(OrderStatus.COMPLETED);
        assertThat(served.getCompletedAt()).isNotNull();
        assertThat(session.getClosedBy()).isEqualTo(waiter);
    }

    @Test
    void closeStillBlocksOnLiveKitchenOrders() {
        when(orders.findBySessionIdOrderByPlacedAtAsc(sessionId))
                .thenReturn(List.of(order(OrderStatus.PREPARING)));

        assertThatThrownBy(() -> service.closeSession(sessionId))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void closeBlockedWhenBillUnpaid() {
        when(orders.findBySessionIdOrderByPlacedAtAsc(sessionId)).thenReturn(List.of());
        when(orderService.bill("tok")).thenReturn(unpaidBill());

        assertThatThrownBy(() -> service.closeSession(sessionId))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Collect");
        assertThat(session.getStatus()).isEqualTo("ACTIVE");
    }

    @Test
    void waiterCannotForceCloseUnpaidButManagerCan() {        when(orders.findBySessionIdOrderByPlacedAtAsc(sessionId)).thenReturn(List.of());
        when(orderService.bill("tok")).thenReturn(unpaidBill());

        // Waiter force attempt → 403.
        assertThatThrownBy(() -> service.closeSession(sessionId, true))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);

        // Manager force attempt → closes.
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(waiterId.toString(), null,
                        List.of(new SimpleGrantedAuthority("ROLE_MANAGER"))));
        SessionResponse res = service.closeSession(sessionId, true);
        assertThat(res.getStatus()).isEqualTo("CLOSED");
    }

    @Test
    void closeExposesAssignedWaiterFirstNameOnly() {
        table.setAssignedWaiter(User.builder().id(UUID.randomUUID()).fullName("Sonu Sharma").build());
        when(orders.findBySessionIdOrderByPlacedAtAsc(sessionId)).thenReturn(List.of());
        when(orderService.bill("tok")).thenReturn(paidBill());

        SessionResponse res = service.closeSession(sessionId);

        assertThat(res.getWaiterName()).isEqualTo("Sonu");
    }

    @Test
    void closeHidesWaiterNameWhenUnassigned() {
        when(orders.findBySessionIdOrderByPlacedAtAsc(sessionId)).thenReturn(List.of());
        when(orderService.bill("tok")).thenReturn(paidBill());

        SessionResponse res = service.closeSession(sessionId);

        assertThat(res.getWaiterName()).isNull();
    }

    private BillResponse paidBill() {
        return new BillResponse("T10", List.of(), java.math.BigDecimal.ZERO, java.math.BigDecimal.ZERO,
                java.math.BigDecimal.ZERO, java.math.BigDecimal.ZERO,
                java.math.BigDecimal.ZERO, java.math.BigDecimal.ZERO, "PAID");
    }

    private BillResponse unpaidBill() {
        return new BillResponse("T10",
                List.of(new BillLine("ORD-1", "1 item", new java.math.BigDecimal("249.00"))),
                new java.math.BigDecimal("249.00"), java.math.BigDecimal.ZERO, java.math.BigDecimal.ZERO,
                new java.math.BigDecimal("249.00"),
                java.math.BigDecimal.ZERO, new java.math.BigDecimal("249.00"), "UNPAID");
    }
}
