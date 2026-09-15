package com.tablepulse.order;

import com.tablepulse.common.dto.ApiResponse;
import com.tablepulse.order.dto.OrderDtos.CancelOrderRequest;
import com.tablepulse.order.dto.OrderDtos.CreateSessionRequest;
import com.tablepulse.order.dto.OrderDtos.PlaceOrderRequest;
import com.tablepulse.order.dto.OrderViews.BillResponse;
import com.tablepulse.order.dto.OrderViews.OrderResponse;
import com.tablepulse.order.dto.OrderViews.SessionResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Customer-facing ordering APIs — secured by table session token, no login. */
@RestController
@RequestMapping("/api/public")
public class PublicOrderController {

    private final OrderService service;

    public PublicOrderController(OrderService service) {
        this.service = service;
    }

    @PostMapping("/sessions")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<SessionResponse> createSession(@Valid @RequestBody CreateSessionRequest req) {
        return ApiResponse.ok("Session started", service.createSession(req));
    }

    @GetMapping("/sessions/{token}")
    public ApiResponse<SessionResponse> getSession(@PathVariable String token) {
        return ApiResponse.ok("Session fetched", service.getSession(token));
    }

    @PostMapping("/orders")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<OrderResponse> placeOrder(@Valid @RequestBody PlaceOrderRequest req) {
        return ApiResponse.ok("Order placed", service.placeOrder(req));
    }

    @GetMapping("/orders/{id}")
    public ApiResponse<OrderResponse> getOrder(@PathVariable UUID id,
                                               @RequestParam("token") String token) {
        return ApiResponse.ok("Order fetched", service.getOrderForCustomer(id, token));
    }

    @PostMapping("/orders/{id}/cancel")
    public ApiResponse<OrderResponse> cancelOrder(@PathVariable UUID id,
                                                  @Valid @RequestBody CancelOrderRequest req) {
        return ApiResponse.ok("Order cancelled", service.cancelOrderCustomer(id, req));
    }

    @GetMapping("/sessions/{token}/orders")
    public ApiResponse<List<OrderResponse>> sessionOrders(@PathVariable String token) {
        return ApiResponse.ok("Session orders fetched", service.listSessionOrders(token));
    }

    @GetMapping("/sessions/{token}/bill")
    public ApiResponse<BillResponse> bill(@PathVariable String token) {
        return ApiResponse.ok("Bill fetched", service.bill(token));
    }
}
