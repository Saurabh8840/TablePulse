package com.tablepulse.payment.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

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
    }

    @Data
    public static class PayAtCounterRequest {
        @NotBlank(message = "sessionToken is required")
        private String sessionToken;
    }

    @Data
    public static class PaymentResponse {
        private final UUID id;
        private final UUID sessionId;
        private final BigDecimal total;
        private final String method;
        private final String status;
        private final Instant paidAt;
    }
}
