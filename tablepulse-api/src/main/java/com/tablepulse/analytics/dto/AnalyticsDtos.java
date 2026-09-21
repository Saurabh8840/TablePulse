package com.tablepulse.analytics.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;

public class AnalyticsDtos {

    @Data
    @AllArgsConstructor
    public static class DashboardSummary {
        private BigDecimal todayRevenue;
        private long ordersToday;
        private long activeTables;
        private Double avgPrepMinutes;
        private long paymentsToday;
        private BigDecimal todayOrderValue;
    }

    @Data
    @AllArgsConstructor
    public static class RevenuePoint {
        private String date;
        private BigDecimal revenue;
        private long orders;
        private BigDecimal orderValue;
    }

    @Data
    @AllArgsConstructor
    public static class RevenueMonth {
        private String month;
        private BigDecimal revenue;
        private long orders;
        private BigDecimal orderValue;
    }

    @Data
    @AllArgsConstructor
    public static class TopItem {
        private String name;
        private long quantity;
        private BigDecimal revenue;
    }

    @Data
    @AllArgsConstructor
    public static class RestaurantSummary {
        private java.util.UUID restaurantId;
        private String name;
        private String slug;
        private int branchCount;
        private BigDecimal todayRevenue;
        private long ordersToday;
        private long activeTables;
        private BigDecimal balanceDue;
    }
}
