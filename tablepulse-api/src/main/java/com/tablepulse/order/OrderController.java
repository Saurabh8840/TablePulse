package com.tablepulse.order;

import com.tablepulse.common.dto.ApiResponse;
import com.tablepulse.order.dto.OrderDtos.UpdateStatusRequest;
import com.tablepulse.order.dto.OrderViews.OrderResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Staff order APIs — JWT required, tenant scoped. */
@RestController
@RequestMapping("/api")
public class OrderController {

    private final OrderService service;

    public OrderController(OrderService service) {
        this.service = service;
    }

    @GetMapping("/orders")
    public ApiResponse<List<OrderResponse>> search(
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String date,
            @RequestParam(required = false, defaultValue = "false") boolean liveOnly) {
        return ApiResponse.ok("Orders fetched", service.searchOrders(branchId, status, date, liveOnly));
    }

    @GetMapping("/orders/{id}")
    public ApiResponse<OrderResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok("Order fetched", service.getOrder(id));
    }

    @PatchMapping("/orders/{id}/status")
    public ApiResponse<OrderResponse> updateStatus(@PathVariable UUID id,
                                                   @Valid @RequestBody UpdateStatusRequest req) {
        return ApiResponse.ok("Order status updated",
                service.updateStatus(id, req.getStatus(), req.getReason()));
    }
}
