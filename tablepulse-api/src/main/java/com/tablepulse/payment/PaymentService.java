package com.tablepulse.payment;

import com.tablepulse.auth.User;
import com.tablepulse.auth.UserRepository;
import com.tablepulse.common.security.TenantGuard;
import com.tablepulse.order.Order;
import com.tablepulse.order.OrderRepository;
import com.tablepulse.order.OrderService;
import com.tablepulse.order.OrderStatus;
import com.tablepulse.order.TableSession;
import com.tablepulse.order.TableSessionRepository;
import com.tablepulse.order.dto.OrderViews.BillResponse;
import com.tablepulse.payment.dto.PaymentDtos.PaymentResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Phase 6 — mock payments with strict close.
 * Bill totals always come from OrderService.bill() (no client-supplied total).
 * Razorpay plugs in later via PaymentGateway without touching service logic.
 */
@Service
public class PaymentService {

    /** Same set as WaiterService.BLOCKING — these keep a table busy. */
    private static final Set<OrderStatus> BLOCKING = EnumSet.of(
            OrderStatus.PLACED, OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY);

    /** Gateway seam — mock now, Razorpay later. */
    public interface PaymentGateway {
        String charge(BillResponse bill, PaymentMethod method);
    }

    /** Mock gateway — always succeeds after validation. */
    public static class MockGateway implements PaymentGateway {
        @Override
        public String charge(BillResponse bill, PaymentMethod method) {
            if (bill.getTotalAmount() == null || bill.getTotalAmount().signum() <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No billable amount to charge");
            }
            return "mock-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        }
    }

    private final TableSessionRepository sessions;
    private final OrderRepository orders;
    private final PaymentRepository payments;
    private final OrderService orderService;
    private final TenantGuard guard;
    private final UserRepository users;
    private final PaymentGateway gateway;

    @Autowired
    public PaymentService(TableSessionRepository sessions, OrderRepository orders,
                          PaymentRepository payments, OrderService orderService,
                          TenantGuard guard, UserRepository users) {
        this(sessions, orders, payments, orderService, guard, users, new MockGateway());
    }

    PaymentService(TableSessionRepository sessions, OrderRepository orders,
                   PaymentRepository payments, OrderService orderService,
                   TenantGuard guard, UserRepository users, PaymentGateway gateway) {
        this.sessions = sessions;
        this.orders = orders;
        this.payments = payments;
        this.orderService = orderService;
        this.guard = guard;
        this.users = users;
        this.gateway = gateway;
    }

    // ---------- Customer (public, session-token scoped) ----------

    @Transactional
    public PaymentResponse confirmMock(String sessionToken, String methodRaw) {
        PaymentMethod method = parseMockMethod(methodRaw);
        TableSession session = sessionByToken(sessionToken);

        Optional<Payment> done = payments.findFirstBySessionIdAndStatusOrderByCreatedAtDesc(
                session.getId(), PaymentStatus.COMPLETED);
        if (done.isPresent()) {
            return toResponse(done.get());
        }
        if (!"ACTIVE".equals(session.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Session is already closed");
        }
        if (!session.getTable().isActive()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Table is not active");
        }

        BillResponse bill = orderService.bill(session.getSessionToken());
        if (bill.getOrders() == null || bill.getOrders().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No billable orders yet");
        }
        assertNoBlockingOrders(session.getId());
        String gatewayRef = gateway.charge(bill, method);

        Payment payment = payments.findFirstBySessionIdAndStatusOrderByCreatedAtDesc(
                        session.getId(), PaymentStatus.PENDING)
                .map(p -> {
                    p.setSubtotal(bill.getSubtotal());
                    p.setTaxAmount(bill.getTaxAmount());
                    p.setServiceCharge(bill.getServiceCharge());
                    p.setTotalAmount(bill.getTotalAmount());
                    p.setPaymentMethod(method);
                    p.setStatus(PaymentStatus.COMPLETED);
                    p.setGatewayRef(gatewayRef);
                    p.setPaidAt(Instant.now());
                    return p;
                })
                .orElseGet(() -> Payment.builder()
                        .session(session)
                        .tenant(session.getTable().getBranch().getRestaurant().getTenant())
                        .branch(session.getTable().getBranch())
                        .subtotal(bill.getSubtotal())
                        .taxAmount(bill.getTaxAmount())
                        .serviceCharge(bill.getServiceCharge())
                        .totalAmount(bill.getTotalAmount())
                        .paymentMethod(method)
                        .status(PaymentStatus.COMPLETED)
                        .gatewayRef(gatewayRef)
                        .paidAt(Instant.now())
                        .build());
        Payment saved = payments.save(payment);
        closeSessionWithCompletedOrders(session, null);
        return toResponse(saved);
    }

    @Transactional
    public PaymentResponse payAtCounter(String sessionToken) {
        TableSession session = sessionByToken(sessionToken);

        Optional<Payment> done = payments.findFirstBySessionIdAndStatusOrderByCreatedAtDesc(
                session.getId(), PaymentStatus.COMPLETED);
        if (done.isPresent()) {
            return toResponse(done.get());
        }
        if (!"ACTIVE".equals(session.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Session is already closed");
        }
        if (!session.getTable().isActive()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Table is not active");
        }

        BillResponse bill = orderService.bill(session.getSessionToken());
        if (bill.getOrders() == null || bill.getOrders().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No billable orders yet");
        }
        assertNoBlockingOrders(session.getId());

        Optional<Payment> pendingCash = payments.findFirstBySessionIdAndStatusOrderByCreatedAtDesc(
                        session.getId(), PaymentStatus.PENDING)
                .filter(p -> p.getPaymentMethod() == PaymentMethod.CASH);
        if (pendingCash.isPresent()) {
            return toResponse(pendingCash.get());
        }

        Payment saved = payments.save(Payment.builder()
                .session(session)
                .tenant(session.getTable().getBranch().getRestaurant().getTenant())
                .branch(session.getTable().getBranch())
                .subtotal(bill.getSubtotal())
                .taxAmount(bill.getTaxAmount())
                .serviceCharge(bill.getServiceCharge())
                .totalAmount(bill.getTotalAmount())
                .paymentMethod(PaymentMethod.CASH)
                .status(PaymentStatus.PENDING)
                .build());
        return toResponse(saved);
    }

    // ---------- Staff (JWT, tenant scoped) ----------

    @Transactional(readOnly = true)
    public List<PaymentResponse> list(UUID branchId, String date) {
        UUID tenantId = TenantGuard.tenantId();
        if (branchId != null) {
            guard.branch(branchId);
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
        return payments.search(tenantId, branchId, from, to).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public PaymentResponse completeCash(UUID paymentId) {
        requireFloorRole();
        Payment payment = payments.findById(paymentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found"));
        if (!payment.getTenant().getId().equals(TenantGuard.tenantId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found");
        }
        if (payment.getStatus() == PaymentStatus.COMPLETED) {
            return toResponse(payment);
        }
        if (payment.getStatus() != PaymentStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only pending payments can be completed");
        }

        TableSession session = payment.getSession();
        Optional<Payment> done = payments.findFirstBySessionIdAndStatusOrderByCreatedAtDesc(
                session.getId(), PaymentStatus.COMPLETED);
        if (done.isPresent()) {
            return toResponse(done.get());
        }
        if (!"ACTIVE".equals(session.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Session is already closed");
        }
        assertNoBlockingOrders(session.getId());

        // Recompute from bill() so totals can't drift if more orders arrived.
        BillResponse bill = orderService.bill(session.getSessionToken());
        payment.setSubtotal(bill.getSubtotal());
        payment.setTaxAmount(bill.getTaxAmount());
        payment.setServiceCharge(bill.getServiceCharge());
        payment.setTotalAmount(bill.getTotalAmount());
        payment.setStatus(PaymentStatus.COMPLETED);
        payment.setPaidAt(Instant.now());
        if (payment.getGatewayRef() == null) {
            payment.setGatewayRef("cash-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
        }
        Payment saved = payments.save(payment);
        closeSessionWithCompletedOrders(session, currentUser());
        return toResponse(saved);
    }

    // ---------- internals ----------

    private PaymentMethod parseMockMethod(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "method is required");
        }
        try {
            PaymentMethod method = PaymentMethod.valueOf(raw.trim().toUpperCase());
            if (method == PaymentMethod.CASH) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use pay-at-counter for cash");
            }
            return method;
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown method: " + raw);
        }
    }

    private void assertNoBlockingOrders(UUID sessionId) {
        long blocking = orders.findBySessionIdOrderByPlacedAtAsc(sessionId).stream()
                .filter(o -> BLOCKING.contains(o.getStatus()))
                .count();
        if (blocking > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Serve or cancel " + blocking + " open order(s) first");
        }
    }

    private void closeSessionWithCompletedOrders(TableSession session, User closedBy) {
        Instant now = Instant.now();
        for (Order o : orders.findBySessionIdOrderByPlacedAtAsc(session.getId())) {
            if (o.getStatus() == OrderStatus.SERVED) {
                o.setStatus(OrderStatus.COMPLETED);
                o.setCompletedAt(now);
                orders.save(o);
            }
        }
        session.setStatus("CLOSED");
        session.setClosedAt(now);
        session.setClosedBy(closedBy);
        sessions.save(session);
    }

    private TableSession sessionByToken(String token) {
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sessionToken is required");
        }
        return sessions.findBySessionToken(token.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));
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

    private PaymentResponse toResponse(Payment p) {
        return new PaymentResponse(
                p.getId(),
                p.getSession().getId(),
                p.getTotalAmount(),
                p.getPaymentMethod() != null ? p.getPaymentMethod().name() : null,
                p.getStatus() != null ? p.getStatus().name() : null,
                p.getPaidAt());
    }
}
