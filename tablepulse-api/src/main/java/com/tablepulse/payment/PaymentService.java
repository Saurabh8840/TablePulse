package com.tablepulse.payment;

import com.tablepulse.auth.UserRepository;
import com.tablepulse.common.security.TenantGuard;
import com.tablepulse.order.OrderRepository;
import com.tablepulse.order.OrderService;
import com.tablepulse.order.TableSession;
import com.tablepulse.order.TableSessionRepository;
import com.tablepulse.order.dto.OrderViews.BillResponse;
import com.tablepulse.payment.dto.PaymentDtos.PaymentResponse;
import com.tablepulse.payment.dto.PaymentDtos.PaymentSummary;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Phase 6b — pay-anytime mock payments with waiter-only close.
 * Customer can pay the moment an order is placed (Domino's prepaid) or
 * later after food is served. Payment NEVER closes the session — only
 * WaiterService.closeSession() does. Multiple COMPLETED payments per
 * session are allowed (top-ups when more food is ordered after paying).
 * Bill totals always come from OrderService.bill() (no client-supplied total).
 * Razorpay plugs in later via PaymentGateway without touching service logic.
 */
@Service
public class PaymentService {

    /** Gateway seam — mock now, Razorpay later. Amount = exact charge for this transaction. */
    public interface PaymentGateway {
        String charge(BigDecimal amount, PaymentMethod method);
    }

    /** Mock gateway — always succeeds after validation. */
    public static class MockGateway implements PaymentGateway {
        @Override
        public String charge(BigDecimal amount, PaymentMethod method) {
            if (amount == null || amount.signum() <= 0) {
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
    // Pay-anytime: no kitchen-status guard. Session stays ACTIVE; waiter closes.

    @Transactional
    public PaymentResponse confirmMock(String sessionToken, String methodRaw) {
        return confirmMock(sessionToken, methodRaw, null, null, null);
    }

    @Transactional
    public PaymentResponse confirmMock(String sessionToken, String methodRaw,
                                       BigDecimal amount, String customerName, String customerPhone) {
        PaymentMethod method = parseMockMethod(methodRaw);
        TableSession session = sessionByToken(sessionToken);

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
        BigDecimal paidTotal = paidTotal(session.getId());
        BigDecimal balanceDue = bill.getTotalAmount().subtract(paidTotal);
        if (balanceDue.signum() <= 0) {
            // Already fully paid — idempotent: return the latest receipt.
            Payment last = payments.findFirstBySessionIdAndStatusOrderByCreatedAtDesc(
                    session.getId(), PaymentStatus.COMPLETED)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Already paid in full"));
            return toResponse(last, paidTotal, BigDecimal.ZERO, "PAID");
        }
        BigDecimal chargeAmount = amount != null ? amount : balanceDue;
        if (chargeAmount.signum() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "amount must be positive");
        }
        if (chargeAmount.compareTo(balanceDue) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "amount exceeds balance due of " + balanceDue);
        }
        String gatewayRef = gateway.charge(chargeAmount, method);

        // Each top-up is its own COMPLETED row; totalAmount = this charge.
        // Subtotal/tax/service snapshot the bill at charge time (informational).
        Payment payment = Payment.builder()
                .session(session)
                .tenant(session.getTable().getBranch().getRestaurant().getTenant())
                .branch(session.getTable().getBranch())
                .subtotal(bill.getSubtotal())
                .taxAmount(bill.getTaxAmount())
                .serviceCharge(bill.getServiceCharge())
                .totalAmount(chargeAmount)
                .paymentMethod(method)
                .status(PaymentStatus.COMPLETED)
                .gatewayRef(gatewayRef)
                .customerName(trimOrNull(customerName))
                .customerPhone(trimOrNull(customerPhone))
                .paidAt(Instant.now())
                .build();
        Payment saved = payments.save(payment);
        // Session stays ACTIVE — waiter closes the table, never payment.
        BigDecimal newPaid = paidTotal.add(chargeAmount);
        BigDecimal newBalance = bill.getTotalAmount().subtract(newPaid);
        if (newBalance.signum() < 0) newBalance = BigDecimal.ZERO;
        return toResponse(saved, newPaid, newBalance,
                newBalance.signum() <= 0 ? "PAID" : "PARTIAL");
    }

    @Transactional
    public PaymentResponse payAtCounter(String sessionToken) {
        return payAtCounter(sessionToken, null, null);
    }

    @Transactional
    public PaymentResponse payAtCounter(String sessionToken, String customerName, String customerPhone) {
        TableSession session = sessionByToken(sessionToken);

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
        BigDecimal paidTotal = paidTotal(session.getId());
        BigDecimal balanceDue = bill.getTotalAmount().subtract(paidTotal);
        if (balanceDue.signum() <= 0) {
            Payment last = payments.findFirstBySessionIdAndStatusOrderByCreatedAtDesc(
                    session.getId(), PaymentStatus.COMPLETED)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Already paid in full"));
            return toResponse(last, paidTotal, BigDecimal.ZERO, "PAID");
        }

        Optional<Payment> pendingCash = payments.findFirstBySessionIdAndStatusOrderByCreatedAtDesc(
                        session.getId(), PaymentStatus.PENDING)
                .filter(p -> p.getPaymentMethod() == PaymentMethod.CASH);
        if (pendingCash.isPresent()) {
            // Bill may have grown since the customer tapped — refresh the pending amount.
            Payment p = pendingCash.get();
            p.setSubtotal(bill.getSubtotal());
            p.setTaxAmount(bill.getTaxAmount());
            p.setServiceCharge(bill.getServiceCharge());
            p.setTotalAmount(balanceDue);
            if (trimOrNull(customerName) != null) p.setCustomerName(customerName.trim());
            if (trimOrNull(customerPhone) != null) p.setCustomerPhone(customerPhone.trim());
            Payment saved = payments.save(p);
            return toResponse(saved, paidTotal, balanceDue,
                    paidTotal.signum() <= 0 ? "UNPAID" : "PARTIAL");
        }

        Payment saved = payments.save(Payment.builder()
                .session(session)
                .tenant(session.getTable().getBranch().getRestaurant().getTenant())
                .branch(session.getTable().getBranch())
                .subtotal(bill.getSubtotal())
                .taxAmount(bill.getTaxAmount())
                .serviceCharge(bill.getServiceCharge())
                .totalAmount(balanceDue)
                .paymentMethod(PaymentMethod.CASH)
                .status(PaymentStatus.PENDING)
                .customerName(trimOrNull(customerName))
                .customerPhone(trimOrNull(customerPhone))
                .build());
        return toResponse(saved, paidTotal, balanceDue,
                paidTotal.signum() <= 0 ? "UNPAID" : "PARTIAL");
    }

    @Transactional(readOnly = true)
    public PaymentSummary paymentSummary(String sessionToken) {
        TableSession session = sessionByToken(sessionToken);
        BillResponse bill = orderService.bill(session.getSessionToken());
        BigDecimal paid = paidTotal(session.getId());
        BigDecimal pendingCash = payments.findBySessionIdOrderByCreatedAtDesc(session.getId()).stream()
                .filter(p -> p.getStatus() == PaymentStatus.PENDING
                        && p.getPaymentMethod() == PaymentMethod.CASH
                        && p.getTotalAmount() != null)
                .map(Payment::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal balance = bill.getTotalAmount().subtract(paid);
        if (balance.signum() < 0) balance = BigDecimal.ZERO;
        String status = paid.signum() <= 0 ? "UNPAID" : balance.signum() <= 0 ? "PAID" : "PARTIAL";
        return new PaymentSummary(session.getId(), bill.getTotalAmount(), paid, pendingCash, balance, status);
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
                .map(p -> {
                    BigDecimal paid = paidTotal(p.getSession().getId());
                    BillResponse bill = orderService.bill(p.getSession().getSessionToken());
                    BigDecimal balance = bill.getTotalAmount().subtract(paid);
                    if (balance.signum() < 0) balance = BigDecimal.ZERO;
                    String st = paid.signum() <= 0 ? "UNPAID"
                            : balance.signum() <= 0 ? "PAID" : "PARTIAL";
                    return toResponse(p, paid, balance, st);
                })
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
            PaymentSummary summary = paymentSummary(payment.getSession().getSessionToken());
            return toResponse(payment, summary.getPaidTotal(), summary.getBalanceDue(),
                    summary.getPaymentStatus());
        }
        if (payment.getStatus() != PaymentStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only pending payments can be completed");
        }

        TableSession session = payment.getSession();
        if (!"ACTIVE".equals(session.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Session is already closed");
        }
        // Recompute from bill() so totals can't drift if more orders arrived.
        // Collect the full remaining balance in this cash tap (top-ups stay digital).
        BillResponse bill = orderService.bill(session.getSessionToken());
        BigDecimal paidExcludingThis = paidTotal(session.getId());
        BigDecimal balanceDue = bill.getTotalAmount().subtract(paidExcludingThis);
        if (balanceDue.signum() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Session is already paid in full");
        }
        payment.setSubtotal(bill.getSubtotal());
        payment.setTaxAmount(bill.getTaxAmount());
        payment.setServiceCharge(bill.getServiceCharge());
        payment.setTotalAmount(balanceDue);
        payment.setStatus(PaymentStatus.COMPLETED);
        payment.setPaidAt(Instant.now());
        if (payment.getGatewayRef() == null) {
            payment.setGatewayRef("cash-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
        }
        Payment saved = payments.save(payment);
        // Session stays ACTIVE — waiter closes the table via closeSession().
        BigDecimal newPaid = paidExcludingThis.add(balanceDue);
        return toResponse(saved, newPaid, BigDecimal.ZERO, "PAID");
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

    /** SUM of COMPLETED charges for a session — the single paid-math helper. */
    private BigDecimal paidTotal(UUID sessionId) {
        return payments.findBySessionIdOrderByCreatedAtDesc(sessionId).stream()
                .filter(p -> p.getStatus() == PaymentStatus.COMPLETED && p.getTotalAmount() != null)
                .map(Payment::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private String trimOrNull(String raw) {
        if (raw == null || raw.isBlank()) return null;
        return raw.trim();
    }

    private TableSession sessionByToken(String token) {
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sessionToken is required");
        }
        return sessions.findBySessionToken(token.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));
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

    private PaymentResponse toResponse(Payment p, BigDecimal paidTotal, BigDecimal balanceDue,
                                       String paymentStatus) {
        return new PaymentResponse(
                p.getId(),
                p.getSession().getId(),
                p.getTotalAmount(),
                p.getPaymentMethod() != null ? p.getPaymentMethod().name() : null,
                p.getStatus() != null ? p.getStatus().name() : null,
                p.getPaidAt(),
                paidTotal,
                balanceDue,
                paymentStatus);
    }
}
