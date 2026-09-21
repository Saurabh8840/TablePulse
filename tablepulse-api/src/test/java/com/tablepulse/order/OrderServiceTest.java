package com.tablepulse.order;

import com.tablepulse.auth.Tenant;
import com.tablepulse.auth.TenantContext;
import com.tablepulse.auth.UserRepository;
import com.tablepulse.common.security.TenantGuard;
import com.tablepulse.menu.MenuCategory;
import com.tablepulse.menu.MenuItem;
import com.tablepulse.menu.MenuItemRepository;
import com.tablepulse.menu.ModifierGroupRepository;
import com.tablepulse.menu.ModifierOptionRepository;
import com.tablepulse.order.dto.OrderDtos.OrderLineRequest;
import com.tablepulse.order.dto.OrderDtos.PlaceOrderRequest;
import com.tablepulse.order.dto.OrderViews.OrderResponse;
import com.tablepulse.restaurant.Branch;
import com.tablepulse.restaurant.BranchRepository;
import com.tablepulse.restaurant.Restaurant;
import com.tablepulse.table.RestaurantTable;
import com.tablepulse.table.RestaurantTableRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Order numbers must never repeat per branch (uq_orders_branch_number),
 * so a new day carries over instead of restarting at ORD-1001.
 */
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

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
    private TableSession session;
    private Branch branch;
    private UUID branchId;
    private UUID tenantId;
    private MenuItem item;
    private UUID itemId;

    @BeforeEach
    void setUp() {
        service = new OrderService(sessions, orders, orderItems, itemModifiers, counters,
                tables, branches, menuItems, modifierGroups, modifierOptions, users, guard, payments);
        tenantId = UUID.randomUUID();
        Tenant tenant = Tenant.builder().id(tenantId).name("MamaBhanje Foods").slug("mamabhanje").build();
        Restaurant restaurant = Restaurant.builder()
                .id(UUID.randomUUID()).tenant(tenant).name("MamaBhanje").slug("mamabhanje")
                .taxPercentage(BigDecimal.ZERO).serviceChargePercentage(BigDecimal.ZERO).build();
        branchId = UUID.randomUUID();
        branch = Branch.builder().id(branchId).restaurant(restaurant).name("Main").build();
        RestaurantTable table = RestaurantTable.builder()
                .id(UUID.randomUUID()).branch(branch).tableNumber("T10").active(true).build();
        session = TableSession.builder()
                .id(UUID.randomUUID()).table(table).sessionToken("tok").status("ACTIVE").build();

        MenuCategory category = MenuCategory.builder()
                .id(UUID.randomUUID()).restaurant(restaurant).name("Mains").active(true).build();
        itemId = UUID.randomUUID();
        item = MenuItem.builder()
                .id(itemId).category(category).name("Thali").price(new BigDecimal("249.00"))
                .active(true).available(true).build();

        // Lenient: the liveOnly test exercises a different path than placeOrder.
        lenient().when(sessions.findBySessionToken("tok")).thenReturn(Optional.of(session));
        lenient().when(menuItems.findById(itemId)).thenReturn(Optional.of(item));
        lenient().when(modifierGroups.findByMenuItemIdOrderByDisplayOrderAsc(itemId)).thenReturn(List.of());
        lenient().when(orderItems.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(orders.save(any())).thenAnswer(inv -> {
            Order o = inv.getArgument(0);
            if (o.getId() == null) o.setId(UUID.randomUUID());
            return o;
        });
        lenient().when(counters.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(counters.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private PlaceOrderRequest request() {
        OrderLineRequest line = new OrderLineRequest();
        line.setMenuItemId(itemId);
        line.setQuantity(1);
        PlaceOrderRequest req = new PlaceOrderRequest();
        req.setSessionToken("tok");
        req.setItems(List.of(line));
        return req;
    }

    @Test
    void newDayCarriesOverFromPreviousDay() {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Kolkata"));
        OrderNumberCounter yesterday = new OrderNumberCounter(branch, today.minusDays(1), 1005);
        when(counters.findByBranchIdAndDay(eq(branchId), any())).thenReturn(Optional.empty());
        when(counters.findFirstByBranchIdAndDayLessThanOrderByDayDesc(eq(branchId), any()))
                .thenReturn(Optional.of(yesterday));

        OrderResponse res = service.placeOrder(request());

        assertThat(res.getOrderNumber()).isEqualTo("ORD-1006");
        ArgumentCaptor<OrderNumberCounter> cap = ArgumentCaptor.forClass(OrderNumberCounter.class);
        verify(counters).saveAndFlush(cap.capture());
        // a fresh row was created for today (seeded from yesterday: 1005 + 1)
        assertThat(cap.getValue().getDay()).isEqualTo(LocalDate.now(ZoneId.of("Asia/Kolkata")));
    }

    @Test
    void noCounterRowResumesPastLegacyOrders() {
        Order legacy1 = Order.builder().orderNumber("ORD-1001").build();
        Order legacy2 = Order.builder().orderNumber("ORD-1003").build();
        Order suffixed = Order.builder().orderNumber("ORD-1001-2").build();
        when(counters.findByBranchIdAndDay(eq(branchId), any())).thenReturn(Optional.empty());
        when(counters.findFirstByBranchIdAndDayLessThanOrderByDayDesc(eq(branchId), any()))
                .thenReturn(Optional.empty());
        when(orders.search(eq(tenantId), eq(branchId), isNull(), isNull(), isNull()))
                .thenReturn(List.of(legacy1, legacy2, suffixed));

        OrderResponse res = service.placeOrder(request());

        assertThat(res.getOrderNumber()).isEqualTo("ORD-1004");
    }

    @Test
    void brandNewBranchStartsAt1001() {
        when(counters.findByBranchIdAndDay(eq(branchId), any())).thenReturn(Optional.empty());
        when(counters.findFirstByBranchIdAndDayLessThanOrderByDayDesc(eq(branchId), any()))
                .thenReturn(Optional.empty());
        when(orders.search(eq(tenantId), eq(branchId), isNull(), isNull(), isNull()))
                .thenReturn(List.of());

        OrderResponse res = service.placeOrder(request());

        assertThat(res.getOrderNumber()).isEqualTo("ORD-1001");
    }

    @Test
    void liveOnlyPollHitsFindLiveAndBatchesLines() {
        TenantContext.set(tenantId);
        try {
            when(guard.branch(branchId)).thenReturn(branch);
            RestaurantTable table = RestaurantTable.builder()
                    .id(UUID.randomUUID()).branch(branch).tableNumber("T10").active(true).build();
            Order live = Order.builder()
                    .id(UUID.randomUUID()).orderNumber("ORD-1010")
                    .table(table).branch(branch)
                    .status(OrderStatus.PLACED)
                    .subtotal(BigDecimal.ZERO).taxAmount(BigDecimal.ZERO)
                    .totalAmount(new BigDecimal("100.00"))
                    .build();
            when(orders.findLive(tenantId, branchId)).thenReturn(List.of(live));

            List<OrderResponse> res = service.searchOrders(branchId, null, null, true);

            assertThat(res).hasSize(1);
            assertThat(res.get(0).getOrderNumber()).isEqualTo("ORD-1010");
            assertThat(res.get(0).getTableNumber()).isEqualTo("T10");
            assertThat(res.get(0).getItems()).isEmpty();
            verify(orders).findLive(tenantId, branchId);
            verify(orders, org.mockito.Mockito.never())
                    .search(any(), any(), any(), any(), any());
            // Lines batched in one shot — no per-order round trips.
            verify(orderItems).findByOrderIdIn(List.of(live.getId()));
        } finally {
            TenantContext.clear();
        }
    }
}
