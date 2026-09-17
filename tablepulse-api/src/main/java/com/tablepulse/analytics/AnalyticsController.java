package com.tablepulse.analytics;

import com.tablepulse.analytics.dto.AnalyticsDtos.DashboardSummary;
import com.tablepulse.analytics.dto.AnalyticsDtos.TopItem;
import com.tablepulse.common.dto.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Owner/manager analytics — JWT required, tenant scoped. Order history reuses GET /api/orders. */
@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService service;

    public AnalyticsController(AnalyticsService service) {
        this.service = service;
    }

    @GetMapping("/dashboard")
    public ApiResponse<DashboardSummary> dashboard(@RequestParam(required = false) UUID branchId) {
        return ApiResponse.ok("Dashboard fetched", service.dashboard(branchId));
    }

    @GetMapping("/revenue")
    public ApiResponse<List<?>> revenue(
            @RequestParam(required = false, defaultValue = "week") String period,
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) String month) {
        if ("year".equalsIgnoreCase(period != null ? period.trim() : "")) {
            return ApiResponse.ok("Revenue fetched", service.revenueByMonth(branchId));
        }
        return ApiResponse.ok("Revenue fetched", service.revenuePoints(period, branchId, month));
    }

    @GetMapping("/top-items")
    public ApiResponse<List<TopItem>> topItems(
            @RequestParam(required = false, defaultValue = "5") int limit,
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) String date) {
        return ApiResponse.ok("Top items fetched", service.topItems(limit, branchId, date));
    }
}
