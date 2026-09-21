package com.tablepulse.order;

import com.tablepulse.auth.TenantContext;
import com.tablepulse.auth.UserRepository;
import com.tablepulse.common.security.TenantGuard;
import com.tablepulse.menu.MenuItemRepository;
import com.tablepulse.menu.ModifierGroupRepository;
import com.tablepulse.menu.ModifierOptionRepository;
import com.tablepulse.order.dto.OrderViews.OrderResponse;
import com.tablepulse.restaurant.Branch;
import com.tablepulse.restaurant.BranchRepository;
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

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * SERVED → COMPLETED is the only manual path to COMPLETED (waiter per-row
 * complete); everything else into/out of COMPLETED stays rejected.
 */
@ExtendWith(MockitoExtension.class)
class OrderUpdateStatusTest {

    @Mock
    private TableSessionRepository sessions;
    @Mock
    private OrderRepository orders;
    @Mock
    private OrderItemRepository orderItems;
    @Mock
    private OrderItemModifierRepository itemModifiers;
    @Mock
    private OrderNumberCounterRepository counters;
    @Mock
    private RestaurantTableRepository tables;
    @Mock
    private BranchRepository branches;
    @Mock
    private MenuItemRepository menuItems;
    @Mock
    private ModifierGroupRepository modifierGroups;
    @Mock
    private ModifierOptionRepository modifierOptions;
    @Mock
    private UserRepository users;
    @Mock
    private TenantGuard guard;
    @Mock
    private com.tablepulse.payment.PaymentRepository payments;

    private OrderService service;
    private UUID tenantId;
    private UUID orderId;
    private Order order;

    @BeforeEach
    void setUp() {
        service = new OrderService(sessions, orders, orderItems, itemModifiers, counters,
                tables, branches, menuItems, modifierGroups, modifierOptions, users, guard, payments);
        tenantId = UUID.randomUUID();
        TenantContext.set(tenantId);
        Branch branch = Branch.builder().id(UUID.randomUUID()).name("Main").build();
        RestaurantTable table = RestaurantTable.builder()
                .id(UUID.randomUUID()).branch(branch).tableNumber("T10").active(true).build();
        orderId = UUID.randomUUID();
        order = Order.builder()
                .id(orderId).orderNumber("ORD-1006").status(OrderStatus.SERVED)
                .table(table).branch(branch)
                .subtotal(new BigDecimal("249.00")).taxAmount(BigDecimal.ZERO)
                .totalAmount(new BigDecimal("249.00"))
                .build();
        when(orders.findByIdAndTenantId(orderId, tenantId)).thenReturn(Optional.of(order));
        lenient().when(orderItems.findByOrderId(orderId)).thenReturn(List.of());
        lenient().when(orders.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    private void loginAs(String role) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(UUID.randomUUID().toString(), null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }

    @Test
    void waiterCompletesServedOrder() {
        loginAs("WAITER");

        OrderResponse res = service.updateStatus(orderId, "COMPLETED", null);

        assertThat(res.getStatus()).isEqualTo("COMPLETED");
        assertThat(order.getStatus()).isEqualTo(OrderStatus.COMPLETED);
        assertThat(order.getCompletedAt()).isNotNull();
    }

    @Test
    void kitchenStaffCannotComplete() {
        loginAs("KITCHEN_STAFF");

        assertThatThrownBy(() -> service.updateStatus(orderId, "COMPLETED", null))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void placedCannotJumpToCompleted() {
        loginAs("WAITER");
        order.setStatus(OrderStatus.PLACED);

        assertThatThrownBy(() -> service.updateStatus(orderId, "COMPLETED", null))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void completedIsTerminal() {
        loginAs("WAITER");
        order.setStatus(OrderStatus.COMPLETED);

        assertThatThrownBy(() -> service.updateStatus(orderId, "COMPLETED", null))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Only served orders can be completed");
    }

    @Test
    void kitchenAcceptFlowStillWorks() {
        loginAs("KITCHEN_STAFF");
        order.setStatus(OrderStatus.PLACED);

        OrderResponse res = service.updateStatus(orderId, "ACCEPTED", null);

        assertThat(res.getStatus()).isEqualTo("ACCEPTED");
    }
}
