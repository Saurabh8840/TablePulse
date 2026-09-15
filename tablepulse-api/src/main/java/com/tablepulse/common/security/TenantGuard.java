package com.tablepulse.common.security;

import com.tablepulse.auth.TenantContext;
import com.tablepulse.menu.MenuCategory;
import com.tablepulse.menu.MenuCategoryRepository;
import com.tablepulse.menu.MenuItem;
import com.tablepulse.menu.MenuItemRepository;
import com.tablepulse.menu.ModifierGroup;
import com.tablepulse.menu.ModifierGroupRepository;
import com.tablepulse.restaurant.Branch;
import com.tablepulse.restaurant.BranchRepository;
import com.tablepulse.restaurant.Restaurant;
import com.tablepulse.restaurant.RestaurantRepository;
import com.tablepulse.table.RestaurantTable;
import com.tablepulse.table.RestaurantTableRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

/**
 * Resolves entities only when they belong to the caller's tenant.
 * Returns 404 (not 403) so one tenant can never probe another's ids.
 */
@Component
public class TenantGuard {

    private final RestaurantRepository restaurants;
    private final BranchRepository branches;
    private final RestaurantTableRepository tables;
    private final MenuCategoryRepository categories;
    private final MenuItemRepository items;
    private final ModifierGroupRepository modifierGroups;

    public TenantGuard(RestaurantRepository restaurants, BranchRepository branches,
                       RestaurantTableRepository tables, MenuCategoryRepository categories,
                       MenuItemRepository items, ModifierGroupRepository modifierGroups) {
        this.restaurants = restaurants;
        this.branches = branches;
        this.tables = tables;
        this.categories = categories;
        this.items = items;
        this.modifierGroups = modifierGroups;
    }

    public static UUID tenantId() {
        UUID id = TenantContext.get();
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired token");
        }
        return id;
    }

    private static void requireSameTenant(UUID ownerTenantId, String resource) {
        if (!ownerTenantId.equals(tenantId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, resource + " not found");
        }
    }

    public Restaurant restaurant(UUID restaurantId) {
        Restaurant r = restaurants.findById(restaurantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Restaurant not found"));
        requireSameTenant(r.getTenant().getId(), "Restaurant");
        return r;
    }

    public Branch branch(UUID branchId) {
        Branch b = branches.findById(branchId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Branch not found"));
        requireSameTenant(b.getRestaurant().getTenant().getId(), "Branch");
        return b;
    }

    public RestaurantTable table(UUID tableId) {
        RestaurantTable t = tables.findById(tableId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Table not found"));
        requireSameTenant(t.getBranch().getRestaurant().getTenant().getId(), "Table");
        return t;
    }

    public MenuCategory category(UUID categoryId) {
        MenuCategory c = categories.findById(categoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found"));
        requireSameTenant(c.getRestaurant().getTenant().getId(), "Category");
        return c;
    }

    public MenuItem item(UUID itemId) {
        MenuItem i = items.findById(itemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Menu item not found"));
        requireSameTenant(i.getCategory().getRestaurant().getTenant().getId(), "Menu item");
        return i;
    }

    public ModifierGroup modifierGroup(UUID groupId) {
        ModifierGroup g = modifierGroups.findById(groupId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Modifier group not found"));
        requireSameTenant(g.getMenuItem().getCategory().getRestaurant().getTenant().getId(), "Modifier group");
        return g;
    }
}
