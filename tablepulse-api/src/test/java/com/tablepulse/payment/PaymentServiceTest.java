package com.tablepulse.payment;

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
import com.tablepulse.payment.dto.PaymentDtos.PaymentResponse;
import com.tablepulse.restaurant.Branch;
import com.tablepulse.restaurant.Restaurant;
import com.tablepulse.table.RestaurantTable;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * DB-free unit tests for strict-close mock payments.
 */
@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    @Mock
    private TableSessionRepository sessions;
    @Mock
    private OrderRepository orders;
    @Mock
    private PaymentRepository payments;
    @Mock
    private OrderService orderService;
    @Mock
    private TenantGuard guard;
    @Mock
    private UserRepository users;

    private PaymentService service;

    private Tenant tenant;
    private Branch branch;
    private RestaurantTable table;
    private TableSession session;
    private UUID tenantId;
    private UUID sessionId;

    @BeforeEach
    void setUp() {
        service = new PaymentService(sessions, orders, payments, orderService, guard, users);
        tenantId = UUID.randomUUID();
        tenant = Tenant.builder().id(tenantId).name("Zen Foods").slug("zen-foods").build();
        Restaurant restaurant = Restaurant.builder()
                .id(UUID.randomUUID())
                .tenant(tenant)
                .name("Cafe Zen")
                .slug("cafe-zen")
                .build();
        branch = Branch.builder().id(UUID.randomUUID()).restaurant(restaurant).name("Koramangala").build();
        table = RestaurantTable.builder()
                .id(UUID.randomUUID()).branch(branch).tableNumber("T12").active(true).build();
        sessionId = UUID.randomUUID();
        session = TableSession.builder()
                .id(sessionId).table(table).sessionToken("tok123").status("ACTIVE").build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    private BillResponse bill() {
        return new BillResponse("T12",
                List.of(new BillLine("ORD-1042", "2 items", new BigDecimal("498.00"))),
                new BigDecimal("498.00"), new BigDecimal("24.90"), new BigDecimal("49.80"),
                new BigDecimal("572.70"));
    }

    private Order order(OrderStatus status) {
        return Order.builder()
                .id(UUID.randomUUID())
                .orderNumber("ORD-1042")
                .session(session).table(table).branch(branch)
                .restaurant(branch.getRestaurant()).tenant(tenant)
                .status(status)
                .subtotal(new BigDecimal("498.00"))
                .taxAmount(new BigDecimal("24.90"))
                .totalAmount(new BigDecimal("522.90"))
                .build();
    }

    @Test
    void strictBlockRejectsLivePlacedOrder() {
        when(sessions.findBySessionToken("tok123")).thenReturn(Optional.of(session));
        when(payments.findFirstBySessionIdAndStatusOrderByCreatedAtDesc(sessionId, PaymentStatus.COMPLETED))
                .thenReturn(Optional.empty());
        when(orderService.bill("tok123")).thenReturn(bill());
        when(orders.findBySessionIdOrderByPlacedAtAsc(sessionId))
                .thenReturn(List.of(order(OrderStatus.PLACED)));

        assertThatThrownBy(() -> service.confirmMock("tok123", "MOCK_UPI"))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        assertThatThrownBy(() -> service.confirmMock("tok123", "MOCK_UPI"))
                .hasMessageContaining("open order");
        verify(payments, never()).save(any());
    }

    @Test
    void happyMockPayClosesSessionAndCompletesServedOrders() {
        Order served = order(OrderStatus.SERVED);
        when(sessions.findBySessionToken("tok123")).thenReturn(Optional.of(session));
        when(payments.findFirstBySessionIdAndStatusOrderByCreatedAtDesc(sessionId, PaymentStatus.COMPLETED))
                .thenReturn(Optional.empty());
        when(orderService.bill("tok123")).thenReturn(bill());
        when(orders.findBySessionIdOrderByPlacedAtAsc(sessionId)).thenReturn(List.of(served));
        when(payments.findFirstBySessionIdAndStatusOrderByCreatedAtDesc(sessionId, PaymentStatus.PENDING))
                .thenReturn(Optional.empty());
        when(payments.save(any())).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            if (p.getId() == null) p.setId(UUID.randomUUID());
            return p;
        });
        when(sessions.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PaymentResponse res = service.confirmMock("tok123", "MOCK_UPI");

        assertThat(res.getStatus()).isEqualTo("COMPLETED");
        assertThat(res.getTotal()).isEqualByComparingTo("572.70");
        assertThat(session.getStatus()).isEqualTo("CLOSED");
        assertThat(session.getClosedBy()).isNull();
        assertThat(served.getStatus()).isEqualTo(OrderStatus.COMPLETED);
        assertThat(served.getCompletedAt()).isNotNull();
        ArgumentCaptor<Payment> cap = ArgumentCaptor.forClass(Payment.class);
        verify(payments).save(cap.capture());
        assertThat(cap.getValue().getGatewayRef()).startsWith("mock-");
    }

    @Test
    void doublePayIsIdempotent() {
        Payment existing = Payment.builder()
                .id(UUID.randomUUID()).session(session).tenant(tenant).branch(branch)
                .totalAmount(new BigDecimal("572.70")).paymentMethod(PaymentMethod.MOCK_UPI)
                .status(PaymentStatus.COMPLETED).gatewayRef("mock-abc").build();
        when(sessions.findBySessionToken("tok123")).thenReturn(Optional.of(session));
        when(payments.findFirstBySessionIdAndStatusOrderByCreatedAtDesc(sessionId, PaymentStatus.COMPLETED))
                .thenReturn(Optional.of(existing));

        PaymentResponse res = service.confirmMock("tok123", "MOCK_UPI");

        assertThat(res.getId()).isEqualTo(existing.getId());
        verify(payments, never()).save(any());
    }

    @Test
    void payAtCounterLeavesActiveAndStaffCompleteCloses() {
        Order served = order(OrderStatus.SERVED);
        when(sessions.findBySessionToken("tok123")).thenReturn(Optional.of(session));
        when(payments.findFirstBySessionIdAndStatusOrderByCreatedAtDesc(sessionId, PaymentStatus.COMPLETED))
                .thenReturn(Optional.empty());
        when(orderService.bill("tok123")).thenReturn(bill());
        when(orders.findBySessionIdOrderByPlacedAtAsc(sessionId)).thenReturn(List.of(served));
        when(payments.findFirstBySessionIdAndStatusOrderByCreatedAtDesc(sessionId, PaymentStatus.PENDING))
                .thenReturn(Optional.empty());
        when(payments.save(any())).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            if (p.getId() == null) p.setId(UUID.randomUUID());
            return p;
        });

        PaymentResponse pending = service.payAtCounter("tok123");

        assertThat(pending.getStatus()).isEqualTo("PENDING");
        assertThat(session.getStatus()).isEqualTo("ACTIVE");

        // Staff completes cash.
        UUID waiterId = UUID.randomUUID();
        User waiter = User.builder().id(waiterId).tenant(tenant).email("w@x.in").fullName("Waiter").build();
        TenantContext.set(tenantId);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(waiterId.toString(), null,
                        List.of(new SimpleGrantedAuthority("ROLE_WAITER"))));
        Payment cashPending = Payment.builder()
                .id(pending.getId()).session(session).tenant(tenant).branch(branch)
                .subtotal(bill().getSubtotal()).taxAmount(bill().getTaxAmount())
                .serviceCharge(bill().getServiceCharge()).totalAmount(bill().getTotalAmount())
                .paymentMethod(PaymentMethod.CASH).status(PaymentStatus.PENDING).build();
        when(payments.findById(pending.getId())).thenReturn(Optional.of(cashPending));
        when(users.findById(waiterId)).thenReturn(Optional.of(waiter));
        when(sessions.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PaymentResponse done = service.completeCash(pending.getId());

        assertThat(done.getStatus()).isEqualTo("COMPLETED");
        assertThat(session.getStatus()).isEqualTo("CLOSED");
        assertThat(session.getClosedBy()).isEqualTo(waiter);
        assertThat(served.getStatus()).isEqualTo(OrderStatus.COMPLETED);
    }

    @Test
    void tamperedTotalIgnoredServiceRecomputesFromBill() {
        Order served = order(OrderStatus.SERVED);
        when(sessions.findBySessionToken("tok123")).thenReturn(Optional.of(session));
        when(payments.findFirstBySessionIdAndStatusOrderByCreatedAtDesc(sessionId, PaymentStatus.COMPLETED))
                .thenReturn(Optional.empty());
        // Bill is the single source of truth — client cannot supply a total.
        when(orderService.bill("tok123")).thenReturn(bill());
        when(orders.findBySessionIdOrderByPlacedAtAsc(sessionId)).thenReturn(List.of(served));
        when(payments.findFirstBySessionIdAndStatusOrderByCreatedAtDesc(sessionId, PaymentStatus.PENDING))
                .thenReturn(Optional.empty());
        ArgumentCaptor<Payment> cap = ArgumentCaptor.forClass(Payment.class);
        when(payments.save(cap.capture())).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            if (p.getId() == null) p.setId(UUID.randomUUID());
            return p;
        });
        when(sessions.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PaymentResponse res = service.confirmMock("tok123", "MOCK_CARD");

        assertThat(res.getTotal()).isEqualByComparingTo(bill().getTotalAmount());
        assertThat(cap.getValue().getTotalAmount()).isEqualByComparingTo(bill().getTotalAmount());
        assertThat(cap.getValue().getSubtotal()).isEqualByComparingTo(bill().getSubtotal());
    }
}
