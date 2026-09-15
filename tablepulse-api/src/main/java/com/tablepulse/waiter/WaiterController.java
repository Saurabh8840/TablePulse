package com.tablepulse.waiter;

import com.tablepulse.common.dto.ApiResponse;
import com.tablepulse.order.dto.OrderViews.SessionResponse;
import com.tablepulse.waiter.dto.TableStatusResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Phase 5 — waiter floor APIs. JWT required, tenant scoped via WaiterService. */
@RestController
@RequestMapping("/api")
public class WaiterController {

    private final WaiterService service;

    public WaiterController(WaiterService service) {
        this.service = service;
    }

    @GetMapping("/branches/{id}/tables/status")
    public ApiResponse<List<TableStatusResponse>> status(@PathVariable UUID id) {
        return ApiResponse.ok("Table status fetched", service.tableStatus(id));
    }

    @PostMapping("/sessions/{id}/close")
    public ApiResponse<SessionResponse> close(@PathVariable UUID id) {
        return ApiResponse.ok("Table closed", service.closeSession(id));
    }
}
