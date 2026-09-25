package com.tablepulse.menu.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class MenuDtos {

    @Data
    @AllArgsConstructor
    public static class CategoryResponse {
        private UUID id;
        private UUID restaurantId;
        private String name;
        private String description;
        private int displayOrder;
        private boolean active;
    }

    @Data
    @AllArgsConstructor
    public static class ItemResponse {
        private UUID id;
        private UUID categoryId;
        private String name;
        private String description;
        private BigDecimal price;
        private String imageUrl;
        private boolean vegetarian;
        private boolean available;
        private Integer preparationTimeMinutes;
        private int displayOrder;
        private boolean active;
        private String lastChangedBy;
        private Instant updatedAt;
    }

    @Data
    @AllArgsConstructor
    public static class ModifierOptionResponse {
        private UUID id;
        private String name;
        private BigDecimal additionalPrice;
        private boolean defaultOption;
        private boolean available;
        private int displayOrder;
    }

    @Data
    @AllArgsConstructor
    public static class ModifierGroupResponse {
        private UUID id;
        private UUID menuItemId;
        private String name;
        private boolean required;
        private int minSelections;
        private int maxSelections;
        private int displayOrder;
        private List<ModifierOptionResponse> options;
    }

    @Data
    @AllArgsConstructor
    public static class PublicItem {
        private UUID id;
        private String name;
        private String description;
        private BigDecimal price;
        private String imageUrl;
        private boolean vegetarian;
        private boolean available;
        private Integer preparationTimeMinutes;
        private List<ModifierGroupResponse> modifierGroups;
    }

    @Data
    @AllArgsConstructor
    public static class PublicCategory {
        private UUID id;
        private String name;
        private String description;
        private List<PublicItem> items;
    }

    @Data
    @AllArgsConstructor
    public static class RestaurantInfo {
        private String name;
        private String slug;
        private String description;
        private String logoUrl;
        private String coverUrl;
        private String currency;
        private BigDecimal taxPercentage;
        private BigDecimal serviceChargePercentage;
    }

    @Data
    @AllArgsConstructor
    public static class FullMenu {
        private RestaurantInfo restaurant;
        private List<PublicCategory> categories;
    }
}
