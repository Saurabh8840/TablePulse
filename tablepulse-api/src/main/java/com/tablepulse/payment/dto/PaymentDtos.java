package com.tablepulse.payment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import lombok.Data;
import org.hibernate.validator.constraints.Length;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public class PaymentDtos {

    @Data
    public static class ConfirmPaymentRequest {
        @NotBlank(message = "sessionToken is required")
        private String sessionToken;

        @NotBlank(message = "method is required")
        private String method;

        /** Charge amount. Null = full remaining balance. Must not exceed balance due. */
        @Positive(message = "amount must be positive")
        private BigDecimal amount;

        /** Optional payer identity for receipts + waiter collection (no login/OTP). */
        @Length(max = 100, message = "name must be at most 100 characters")
        private String customerName;

        @Pattern(regexp = "^[6-9]\\d{9}$", message = "phone must be a 10-digit Indian mobile number")
        private String customerPhone;
    }

    @Data
    public static class PayAtCounterRequest {
        @NotBlank(message = "sessionToken is required")
        private String sessionToken;

        @Length(max = 100, message = "name must be at most 100 characters")
        private String customerName;

        @Pattern(regexp = "^[6-9]\\d{9}$", message = "phone must be a 10-digit Indian mobile number")
        private String customerPhone;
    }

    @Data
    public static class PaymentResponse {
        private final UUID id;
        private final UUID sessionId;
        private final BigDecimal total;
        private final String method;
        private final String status;
        private final Instant paidAt;
        private final BigDecimal paidTotal;
        private final BigDecimal balanceDue;
        private final String paymentStatus;
    }

    @Data
    public static class PaymentSummary {
        private final UUID sessionId;
        private final BigDecimal billTotal;
        private final BigDecimal paidTotal;
        private final BigDecimal pendingCashTotal;
        private final BigDecimal balanceDue;
        private final String paymentStatus;
    }
}
