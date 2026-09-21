package com.tablepulse.order.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class OrderViews {

    @Data
    @AllArgsConstructor
    public static class SessionResponse {
        private UUID sessionId;
        private String sessionToken;
        private UUID tableId;
        private String tableNumber;
        private UUID branchId;
        private String restaurantSlug;
        private String status;
        private Instant startedAt;
        private String closedBy;
        /** First name of the table's assigned waiter; null when unassigned (House). */
        private String waiterName;
    }

    @Data
    @AllArgsConstructor
    public static class ModifierSelection {
        private String modifierName;
        private BigDecimal additionalPrice;
    }

    @Data
    @AllArgsConstructor
    public static class OrderLine {
        private UUID menuItemId;
        private String menuItemName;
        private int quantity;
        private BigDecimal unitPrice;
        private BigDecimal modifiersPrice;
        private BigDecimal totalPrice;
        private String specialInstructions;
        private List<ModifierSelection> modifiers;
    }

    @Data
    @AllArgsConstructor
    public static class OrderResponse {
        private UUID id;
        private String orderNumber;
        private String status;
        private String tableNumber;
        private UUID branchId;
        private BigDecimal subtotal;
        private BigDecimal taxAmount;
        private BigDecimal totalAmount;
        private String specialInstructions;
        private Instant placedAt;
        private List<OrderLine> items;
        private String servedBy;
    }

    @Data
    @AllArgsConstructor
    public static class BillLine {
        private String orderNumber;
        private String summary;
        private BigDecimal amount;
    }

    @Data
    @AllArgsConstructor
    public static class BillResponse {
        private String tableNumber;
        private List<BillLine> orders;
        private BigDecimal subtotal;
        private BigDecimal taxAmount;
        private BigDecimal serviceCharge;
        private BigDecimal totalAmount;
        /** Pay-anytime fields: SUM(COMPLETED payments) vs bill total. */
        private BigDecimal paidTotal;
        private BigDecimal balanceDue;
        /** UNPAID (nothing paid yet), PARTIAL, or PAID. */
        private String paymentStatus;
    }
}
