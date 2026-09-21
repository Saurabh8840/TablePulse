package com.tablepulse.payment;

import com.tablepulse.common.dto.ApiResponse;
import com.tablepulse.payment.dto.PaymentDtos.PaymentResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Staff payment APIs — JWT required, tenant scoped. */
@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private final PaymentService service;

    public PaymentController(PaymentService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<PaymentResponse>> list(
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) String date,
            @RequestParam(required = false) UUID restaurantId) {
        return ApiResponse.ok("Payments fetched", service.list(branchId, date, restaurantId));
    }

    @PatchMapping("/{id}/complete")
    public ApiResponse<PaymentResponse> complete(@PathVariable UUID id) {
        return ApiResponse.ok("Cash payment completed", service.completeCash(id));
    }
}
