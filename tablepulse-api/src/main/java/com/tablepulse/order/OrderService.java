package com.tablepulse.order;

import com.tablepulse.auth.User;
import com.tablepulse.auth.UserRepository;
import com.tablepulse.common.security.TenantGuard;
import com.tablepulse.menu.MenuItem;
import com.tablepulse.menu.MenuItemRepository;
import com.tablepulse.menu.ModifierGroup;
import com.tablepulse.menu.ModifierGroupRepository;
import com.tablepulse.menu.ModifierOption;
import com.tablepulse.menu.ModifierOptionRepository;
import com.tablepulse.order.dto.OrderDtos.CancelOrderRequest;
import com.tablepulse.order.dto.OrderDtos.CreateSessionRequest;
import com.tablepulse.order.dto.OrderDtos.OrderLineRequest;
import com.tablepulse.order.dto.OrderDtos.PlaceOrderRequest;
import com.tablepulse.order.dto.OrderViews.BillLine;
import com.tablepulse.order.dto.OrderViews.BillResponse;
import com.tablepulse.order.dto.OrderViews.ModifierSelection;
import com.tablepulse.order.dto.OrderViews.OrderLine;
import com.tablepulse.order.dto.OrderViews.OrderResponse;
import com.tablepulse.order.dto.OrderViews.SessionResponse;
import com.tablepulse.restaurant.Branch;
import com.tablepulse.restaurant.BranchRepository;
import com.tablepulse.restaurant.Restaurant;
import com.tablepulse.table.RestaurantTable;
import com.tablepulse.table.RestaurantTableRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class OrderService {

    private static final Set<OrderStatus> BILLABLE_EXCLUDED = Set.of(OrderStatus.CANCELLED, OrderStatus.REJECTED);

    private final TableSessionRepository sessions;
    private final OrderRepository orders;
    private final OrderItemRepository orderItems;
    private final OrderItemModifierRepository itemModifiers;
    private final OrderNumberCounterRepository counters;
    private final RestaurantTableRepository tables;
    private final BranchRepository branches;
    private final MenuItemRepository menuItems;
    private final ModifierGroupRepository modifierGroups;
    private final ModifierOptionRepository modifierOptions;
    private final UserRepository users;
    private final TenantGuard guard;

    public OrderService(TableSessionRepository sessions, OrderRepository orders,
                        OrderItemRepository orderItems, OrderItemModifierRepository itemModifiers,
                        OrderNumberCounterRepository counters, RestaurantTableRepository tables,
                        BranchRepository branches, MenuItemRepository menuItems,
                        ModifierGroupRepository modifierGroups, ModifierOptionRepository modifierOptions,
                        UserRepository users, TenantGuard guard) {
        this.sessions = sessions;
        this.orders = orders;
        this.orderItems = orderItems;
        this.itemModifiers = itemModifiers;
        this.counters = counters;
        this.tables = tables;
        this.branches = branches;
        this.menuItems = menuItems;
        this.modifierGroups = modifierGroups;
        this.modifierOptions = modifierOptions;
        this.users = users;
        this.guard = guard;
    }

    // ---------- Customer (public, session-token scoped) ----------

    @Transactional
    public SessionResponse createSession(CreateSessionRequest req) {
        Branch branch = branches.findById(req.getBranchId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Branch not found"));
        if (!branch.isActive() || !branch.getRestaurant().isActive()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Branch is not accepting orders");
        }
        String number = req.getTableNumber().trim();
        RestaurantTable table = tables.findByBranchIdAndTableNumber(branch.getId(), number)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Table not found"));
        if (!table.isActive()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Table is not active");
        }
        List<TableSession> open = sessions.findByTableIdAndStatus(table.getId(), "ACTIVE");
        if (!open.isEmpty()) {
            return toSession(open.get(0));
        }
        TableSession s = sessions.save(TableSession.builder()
                .table(table)
                .sessionToken(UUID.randomUUID().toString().replace("-", ""))
                .status("ACTIVE")
                .build());
        return toSession(s);
    }

    @Transactional(readOnly = true)
    public SessionResponse getSession(String token) {
        return toSession(sessionByToken(token));
    }

    @Transactional
    public OrderResponse placeOrder(PlaceOrderRequest req) {
        TableSession session = sessionByToken(req.getSessionToken());
        if (!"ACTIVE".equals(session.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Session is closed");
        }
        Restaurant restaurant = session.getTable().getBranch().getRestaurant();

        List<PricedLine> lines = new ArrayList<>();
        for (OrderLineRequest line : req.getItems()) {
            lines.add(priceLine(line, restaurant.getId()));
        }

        BigDecimal subtotal = lines.stream().map(l -> l.total).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal tax = pct(subtotal, restaurant.getTaxPercentage());
        String orderNumber = nextOrderNumber(session.getTable().getBranch());

        Order order = orders.save(Order.builder()
                .orderNumber(orderNumber)
                .session(session)
                .table(session.getTable())
                .branch(session.getTable().getBranch())
                .restaurant(restaurant)
                .tenant(restaurant.getTenant())
                .status(OrderStatus.PLACED)
                .subtotal(subtotal)
                .taxAmount(tax)
                .totalAmount(subtotal.add(tax))
                .specialInstructions(req.getSpecialInstructions())
                .build());

        List<OrderLine> outLines = new ArrayList<>();
        for (PricedLine line : lines) {
            OrderItem saved = orderItems.save(OrderItem.builder()
                    .order(order)
                    .menuItem(line.item)
                    .menuItemName(line.item.getName())
                    .quantity(line.qty)
                    .unitPrice(line.item.getPrice())
                    .modifiersPrice(line.modsTotal)
                    .totalPrice(line.total)
                    .specialInstructions(line.note)
                    .build());
            List<ModifierSelection> sels = new ArrayList<>();
            for (PricedMod mod : line.mods) {
                itemModifiers.save(OrderItemModifier.builder()
                        .orderItem(saved)
                        .modifierOption(mod.option)
                        .modifierName(mod.option.getName())
                        .additionalPrice(mod.option.getAdditionalPrice())
                        .build());
                sels.add(new ModifierSelection(mod.option.getName(), mod.option.getAdditionalPrice()));
            }
            outLines.add(new OrderLine(line.item.getId(), line.item.getName(), line.qty,
                    line.item.getPrice(), line.modsTotal, line.total, line.note, sels));
        }
        return toOrder(order, outLines);
    }

    @Transactional(readOnly = true)
    public OrderResponse getOrderForCustomer(UUID orderId, String token) {
        TableSession session = sessionByToken(token);
        Order order = orders.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        if (!order.getSession().getId().equals(session.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
        }
        return toOrder(order, linesOf(order.getId()));
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> listSessionOrders(String token) {
        TableSession session = sessionByToken(token);
        List<OrderResponse> out = new ArrayList<>();
        for (Order o : orders.findBySessionIdOrderByPlacedAtAsc(session.getId())) {
            out.add(toOrder(o, linesOf(o.getId())));
        }
        return out;
    }

    @Transactional
    public OrderResponse cancelOrderCustomer(UUID orderId, CancelOrderRequest req) {
        TableSession session = sessionByToken(req.getSessionToken());
        Order order = orders.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        if (!order.getSession().getId().equals(session.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
        }
        if (order.getStatus() != OrderStatus.PLACED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only newly placed orders can be cancelled");
        }
        order.setStatus(OrderStatus.CANCELLED);
        order.setCancelledAt(Instant.now());
        order.setCancellationReason(req.getReason());
        return toOrder(orders.save(order), linesOf(order.getId()));
    }

    @Transactional(readOnly = true)
    public BillResponse bill(String token) {
        TableSession session = sessionByToken(token);
        Restaurant restaurant = session.getTable().getBranch().getRestaurant();
        List<BillLine> lines = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal tax = BigDecimal.ZERO;
        for (Order o : orders.findBySessionIdOrderByPlacedAtAsc(session.getId())) {
            if (BILLABLE_EXCLUDED.contains(o.getStatus())) continue;
            subtotal = subtotal.add(o.getSubtotal());
            tax = tax.add(o.getTaxAmount());
            long count = orderItems.findByOrderId(o.getId()).stream().mapToInt(OrderItem::getQuantity).sum();
            lines.add(new BillLine(o.getOrderNumber(), count + (count == 1 ? " item" : " items"), o.getTotalAmount()));
        }
        BigDecimal service = pct(subtotal, restaurant.getServiceChargePercentage());
        return new BillResponse(session.getTable().getTableNumber(), lines, subtotal, tax, service,
                subtotal.add(tax).add(service));
    }

    // ---------- Staff (JWT, tenant scoped) ----------

    @Transactional(readOnly = true)
    public List<OrderResponse> searchOrders(UUID branchId, String status, String date) {
        UUID tenantId = TenantGuard.tenantId();
        if (branchId != null) guard.branch(branchId);
        OrderStatus st = null;
        if (status != null && !"ALL".equalsIgnoreCase(status)) {
            try {
                st = OrderStatus.valueOf(status.trim().toUpperCase());
            } catch (IllegalArgumentException ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown status: " + status);
            }
        }
        Instant from = null;
        Instant to = null;
        if (date != null && !date.isBlank()) {
            try {
                LocalDate day = LocalDate.parse(date.trim());
                ZoneId zone = ZoneId.of("Asia/Kolkata");
                from = day.atStartOfDay(zone).toInstant();
                to = day.plusDays(1).atStartOfDay(zone).toInstant();
            } catch (Exception ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Date must be YYYY-MM-DD");
            }
        }
        List<OrderResponse> out = new ArrayList<>();
        for (Order o : orders.search(tenantId, branchId, st, from, to)) {
            out.add(toOrder(o, linesOf(o.getId())));
        }
        return out;
    }

    @Transactional(readOnly = true)
    public OrderResponse getOrder(UUID orderId) {
        Order o = orders.findByIdAndTenantId(orderId, TenantGuard.tenantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        return toOrder(o, linesOf(o.getId()));
    }

    @Transactional
    public OrderResponse updateStatus(UUID orderId, String to, String reason) {
        Order order = orders.findByIdAndTenantId(orderId, TenantGuard.tenantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        OrderStatus target;
        try {
            target = OrderStatus.valueOf(to.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown status: " + to);
        }
        if (target == OrderStatus.COMPLETED && order.getStatus() != OrderStatus.SERVED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only served orders can be completed");
        }
        if (target == OrderStatus.PLACED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status cannot move backwards");
        }
        checkTransition(order.getStatus(), target);
        checkRole(order.getStatus(), target);
        order.setStatus(target);
        Instant now = Instant.now();
        switch (target) {
            case ACCEPTED -> order.setAcceptedAt(now);
            case PREPARING -> order.setPreparingAt(now);
            case READY -> order.setReadyAt(now);
            case SERVED -> {
                order.setServedAt(now);
                order.setServedBy(currentUser());
            }
            case COMPLETED -> order.setCompletedAt(now);
            case REJECTED, CANCELLED -> {
                order.setCancelledAt(now);
                order.setCancellationReason(reason);
            }
            default -> {
            }
        }
        return toOrder(orders.save(order), linesOf(order.getId()));
    }

    // ---------- internals ----------

    private TableSession sessionByToken(String token) {
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sessionToken is required");
        }
        return sessions.findBySessionToken(token.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));
    }

    private record PricedMod(ModifierOption option) {
    }

    private record PricedLine(MenuItem item, int qty, String note, List<PricedMod> mods,
                              BigDecimal modsTotal, BigDecimal total) {
    }

    private PricedLine priceLine(OrderLineRequest line, UUID restaurantId) {
        MenuItem item = menuItems.findById(line.getMenuItemId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown menu item"));
        if (!item.isActive() || !item.getCategory().isActive()
                || !item.getCategory().getRestaurant().getId().equals(restaurantId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Item is not on this restaurant's menu: " + item.getName());
        }
        if (!item.isAvailable()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Item is sold out: " + item.getName());
        }
        if (line.getQuantity() < 1 || line.getQuantity() > 20) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Quantity must be 1-20");
        }
        List<UUID> selected = line.getModifierOptionIds() != null ? line.getModifierOptionIds() : List.of();
        Map<UUID, List<ModifierOption>> byGroup = new HashMap<>();
        BigDecimal modsTotal = BigDecimal.ZERO;
        List<PricedMod> mods = new ArrayList<>();
        for (UUID optionId : selected) {
            ModifierOption opt = modifierOptions.findById(optionId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown modifier option"));
            if (!opt.isAvailable()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Modifier unavailable: " + opt.getName());
            }
            if (!opt.getGroup().getMenuItem().getId().equals(item.getId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Modifier does not belong to " + item.getName() + ": " + opt.getName());
            }
            byGroup.computeIfAbsent(opt.getGroup().getId(), k -> new ArrayList<>()).add(opt);
            modsTotal = modsTotal.add(opt.getAdditionalPrice());
            mods.add(new PricedMod(opt));
        }
        for (ModifierGroup group : modifierGroups.findByMenuItemIdOrderByDisplayOrderAsc(item.getId())) {
            int picked = byGroup.getOrDefault(group.getId(), List.of()).size();
            int min = group.isRequired() ? Math.max(group.getMinSelections(), 1) : group.getMinSelections();
            if (picked < min) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Choose at least " + min + " from " + group.getName());
            }
            if (picked > group.getMaxSelections()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Choose at most " + group.getMaxSelections() + " from " + group.getName());
            }
        }
        BigDecimal total = item.getPrice().add(modsTotal)
                .multiply(BigDecimal.valueOf(line.getQuantity()));
        return new PricedLine(item, line.getQuantity(), line.getSpecialInstructions(), mods, modsTotal, total);
    }

    private String nextOrderNumber(Branch branch) {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Kolkata"));
        OrderNumberCounter counter = lockedCounter(branch, today);
        counter.setLastNumber(counter.getLastNumber() + 1);
        counters.save(counter);
        return "ORD-" + counter.getLastNumber();
    }

    /**
     * Today's counter row, read under a pessimistic write lock so concurrent
     * orders serialize on numbering. If two first-orders-of-the-day race to
     * create the row, the loser re-reads the winner's row instead of 500ing.
     * Numbers are continuous per branch (never restart daily) so they stay
     * unique under uq_orders_branch_number.
     */
    private OrderNumberCounter lockedCounter(Branch branch, LocalDate today) {
        Optional<OrderNumberCounter> existing = counters.findByBranchIdAndDay(branch.getId(), today);
        if (existing.isPresent()) {
            return existing.get();
        }
        int start = startingNumber(branch, today);
        try {
            return counters.saveAndFlush(new OrderNumberCounter(branch, today, start));
        } catch (DataIntegrityViolationException race) {
            return counters.findByBranchIdAndDay(branch.getId(), today)
                    .orElseThrow(() -> race);
        }
    }

    /**
     * Carry over the previous day's counter; if this branch never had a
     * counter row (e.g. only pre-counter orders exist), resume past its
     * highest historical ORD-&lt;n&gt; instead of restarting at 1000.
     */
    private int startingNumber(Branch branch, LocalDate today) {
        Optional<OrderNumberCounter> prev =
                counters.findFirstByBranchIdAndDayLessThanOrderByDayDesc(branch.getId(), today);
        if (prev.isPresent()) {
            return prev.get().getLastNumber();
        }
        UUID tenantId = branch.getRestaurant().getTenant().getId();
        int max = 1000;
        for (Order o : orders.search(tenantId, branch.getId(), null, null, null)) {
            max = Math.max(max, parseOrderNumber(o.getOrderNumber()));
        }
        return max;
    }

    private int parseOrderNumber(String orderNumber) {
        if (orderNumber == null) return 0;
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("^ORD-(\\d+)")
                .matcher(orderNumber.trim());
        if (!m.find()) return 0;
        try {
            return Integer.parseInt(m.group(1));
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    private void checkTransition(OrderStatus from, OrderStatus to) {
        boolean ok = switch (from) {
            case PLACED -> to == OrderStatus.ACCEPTED || to == OrderStatus.REJECTED || to == OrderStatus.CANCELLED;
            case ACCEPTED -> to == OrderStatus.PREPARING || to == OrderStatus.CANCELLED;
            case PREPARING -> to == OrderStatus.READY;
            case READY -> to == OrderStatus.SERVED;
            case SERVED -> to == OrderStatus.COMPLETED;
            default -> false;
        };
        if (!ok) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot move order from " + from + " to " + to);
        }
    }

    private void checkRole(OrderStatus from, OrderStatus to) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean kitchen = hasAny(auth, "ROLE_KITCHEN_STAFF", "ROLE_MANAGER", "ROLE_OWNER");
        boolean floor = hasAny(auth, "ROLE_WAITER", "ROLE_MANAGER", "ROLE_OWNER");
        boolean owner = hasAny(auth, "ROLE_MANAGER", "ROLE_OWNER");
        boolean allowed = switch (to) {
            case ACCEPTED, PREPARING, READY, REJECTED -> kitchen;
            case SERVED, COMPLETED -> floor;
            case CANCELLED -> from == OrderStatus.PLACED ? floor : owner;
            default -> false;
        };
        if (!allowed) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Your role cannot set status " + to);
        }
    }

    private boolean hasAny(Authentication auth, String... roles) {
        if (auth == null) return false;
        for (String r : roles) {
            if (auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals(r))) return true;
        }
        return false;
    }

    private User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired token");
        }
        return users.findById(UUID.fromString(auth.getName()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired token"));
    }

    private BigDecimal pct(BigDecimal base, BigDecimal percent) {
        if (percent == null || percent.signum() == 0) return BigDecimal.ZERO;
        return base.multiply(percent).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    }

    private List<OrderLine> linesOf(UUID orderId) {
        List<OrderItem> items = orderItems.findByOrderId(orderId);
        List<UUID> itemIds = items.stream().map(OrderItem::getId).toList();
        Map<UUID, List<ModifierSelection>> modsByItem = new HashMap<>();
        if (!itemIds.isEmpty()) {
            for (OrderItemModifier m : itemModifiers.findByOrderItemIdIn(itemIds)) {
                modsByItem.computeIfAbsent(m.getOrderItem().getId(), k -> new ArrayList<>())
                        .add(new ModifierSelection(m.getModifierName(), m.getAdditionalPrice()));
            }
        }
        List<OrderLine> out = new ArrayList<>();
        for (OrderItem i : items) {
            out.add(new OrderLine(i.getMenuItem().getId(), i.getMenuItemName(), i.getQuantity(),
                    i.getUnitPrice(), i.getModifiersPrice(), i.getTotalPrice(),
                    i.getSpecialInstructions(), modsByItem.getOrDefault(i.getId(), List.of())));
        }
        return out;
    }

    private SessionResponse toSession(TableSession s) {
        return new SessionResponse(s.getId(), s.getSessionToken(), s.getTable().getId(),
                s.getTable().getTableNumber(), s.getTable().getBranch().getId(),
                s.getTable().getBranch().getRestaurant().getSlug(), s.getStatus(), s.getStartedAt(),
                s.getClosedBy() != null ? s.getClosedBy().getFullName() : null);
    }

    private OrderResponse toOrder(Order o, List<OrderLine> lines) {
        return new OrderResponse(o.getId(), o.getOrderNumber(), o.getStatus().name(),
                o.getTable().getTableNumber(), o.getBranch().getId(), o.getSubtotal(),
                o.getTaxAmount(), o.getTotalAmount(), o.getSpecialInstructions(), o.getPlacedAt(), lines,
                o.getServedBy() != null ? o.getServedBy().getFullName() : null);
    }
}
