package com.tablepulse.payment;

import com.tablepulse.common.dto.ApiResponse;
import com.tablepulse.payment.dto.PaymentDtos.ConfirmPaymentRequest;
import com.tablepulse.payment.dto.PaymentDtos.PayAtCounterRequest;
import com.tablepulse.payment.dto.PaymentDtos.PaymentResponse;
import com.tablepulse.payment.dto.PaymentDtos.PaymentSummary;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Customer-facing payment APIs — secured by table session token, no login. */
@RestController
@RequestMapping("/api/public/payments")
public class PublicPaymentController {

    private final PaymentService service;

    public PublicPaymentController(PaymentService service) {
        this.service = service;
    }

    @PostMapping("/mock-confirm")
    public ApiResponse<PaymentResponse> mockConfirm(@Valid @RequestBody ConfirmPaymentRequest req) {
        return ApiResponse.ok("Payment completed",
                service.confirmMock(req.getSessionToken(), req.getMethod(),
                        req.getAmount(), req.getCustomerName(), req.getCustomerPhone()));
    }

    @PostMapping("/pay-at-counter")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<PaymentResponse> payAtCounter(@Valid @RequestBody PayAtCounterRequest req) {
        return ApiResponse.ok("Pay at counter noted",
                service.payAtCounter(req.getSessionToken(), req.getCustomerName(), req.getCustomerPhone()));
    }

    @GetMapping("/sessions/{token}/payment-status")
    public ApiResponse<PaymentSummary> paymentStatus(@PathVariable String token) {
        return ApiResponse.ok("Payment status fetched", service.paymentSummary(token));
    }
}
