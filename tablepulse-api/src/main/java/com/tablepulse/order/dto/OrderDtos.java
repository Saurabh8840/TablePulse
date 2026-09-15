package com.tablepulse.order.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.UUID;

public class OrderDtos {

    @Data
    public static class CreateSessionRequest {
        @NotNull(message = "branchId is required")
        private UUID branchId;

        @NotBlank(message = "tableNumber is required")
        @Size(max = 10)
        private String tableNumber;
    }

    @Data
    public static class PlaceOrderRequest {
        @NotBlank(message = "sessionToken is required")
        private String sessionToken;

        private String specialInstructions;

        @NotEmpty(message = "At least one item is required")
        private List<OrderLineRequest> items;
    }

    @Data
    public static class OrderLineRequest {
        @NotNull(message = "menuItemId is required")
        private UUID menuItemId;

        @Min(value = 1, message = "quantity must be at least 1")
        private int quantity = 1;

        private List<UUID> modifierOptionIds = List.of();

        @Size(max = 500)
        private String specialInstructions;
    }

    @Data
    public static class UpdateStatusRequest {
        @NotBlank(message = "status is required")
        private String status;

        @Size(max = 500)
        private String reason;
    }

    @Data
    public static class CancelOrderRequest {
        @NotBlank(message = "sessionToken is required")
        private String sessionToken;

        @Size(max = 500)
        private String reason;
    }
}
