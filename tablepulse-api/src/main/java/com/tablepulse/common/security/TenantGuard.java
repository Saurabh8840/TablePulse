package com.tablepulse.common.security;

import com.tablepulse.auth.TenantContext;
import com.tablepulse.auth.User;
import com.tablepulse.auth.UserRepository;
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
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Resolves entities only when they belong to the caller's tenant.
 * Returns 404 (not 403) so one tenant can never probe another's ids.
 *
 * Phase A (outlet isolation): staff pinned to a home branch (users.branch_id)
 * are additionally confined to that outlet — every resolver below 404s outside
 * home, and list paths consult {@link #homeBranch()} to auto-scope. Owners and
 * tenant-wide managers (branch NULL) are unaffected.
 */
@Component
public class TenantGuard {

    private final RestaurantRepository restaurants;
    private final BranchRepository branches;
    private final RestaurantTableRepository tables;
    private final MenuCategoryRepository categories;
    private final MenuItemRepository items;
    private final ModifierGroupRepository modifierGroups;
    private final UserRepository users;

    public TenantGuard(RestaurantRepository restaurants, BranchRepository branches,
                       RestaurantTableRepository tables, MenuCategoryRepository categories,
                       MenuItemRepository items, ModifierGroupRepository modifierGroups,
                       UserRepository users) {
        this.restaurants = restaurants;
        this.branches = branches;
        this.tables = tables;
        this.categories = categories;
        this.items = items;
        this.modifierGroups = modifierGroups;
        this.users = users;
    }

    public static UUID tenantId() {
        UUID id = TenantContext.get();
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired token");
        }
        return id;
    }

    /**
     * The caller's home outlet, if they are outlet-pinned staff.
     * Empty for owners, tenant-wide managers, and anonymous (public) callers.
     * Always invoked inside a service transaction, so lazy loads are safe.
     */
    public Optional<Branch> homeBranch() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return Optional.empty();
        }
        UUID userId;
        try {
            userId = UUID.fromString(auth.getName());
        } catch (Exception ex) {
            return Optional.empty();
        }
        return users.findById(userId)
                .map(User::getBranch)
                .filter(Objects::nonNull);
    }

    /** Outlet-pinned staff cannot touch tenant-wide resources (restaurants, branches as entities). */
    public void requireTenantWide() {
        if (homeBranch().isPresent()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only owners and all-branch managers can do this");
        }
    }

    /** Pin an explicit branch id to home (for update paths that resolve by id + tenant only). */
    public void enforceHomeBranch(UUID branchId) {
        homeBranch().ifPresent(home -> {
            if (!home.getId().equals(branchId)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Branch not found");
            }
        });
    }

    private static void requireSameTenant(UUID ownerTenantId, String resource) {
        if (!ownerTenantId.equals(tenantId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, resource + " not found");
        }
    }

    private static void requireHomeRestaurant(UUID restaurantId, Branch home) {
        if (!home.getRestaurant().getId().equals(restaurantId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Restaurant not found");
        }
    }

    private static void requireHomeBranch(UUID branchId, Branch home) {
        if (!home.getId().equals(branchId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Branch not found");
        }
    }

    public Restaurant restaurant(UUID restaurantId) {
        Restaurant r = restaurants.findById(restaurantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Restaurant not found"));
        requireSameTenant(r.getTenant().getId(), "Restaurant");
        homeBranch().ifPresent(home -> requireHomeRestaurant(r.getId(), home));
        return r;
    }

    public Branch branch(UUID branchId) {
        Branch b = branches.findById(branchId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Branch not found"));
        requireSameTenant(b.getRestaurant().getTenant().getId(), "Branch");
        homeBranch().ifPresent(home -> requireHomeBranch(b.getId(), home));
        return b;
    }

    public RestaurantTable table(UUID tableId) {
        RestaurantTable t = tables.findById(tableId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Table not found"));
        requireSameTenant(t.getBranch().getRestaurant().getTenant().getId(), "Table");
        homeBranch().ifPresent(home -> requireHomeBranch(t.getBranch().getId(), home));
        return t;
    }

    public MenuCategory category(UUID categoryId) {
        MenuCategory c = categories.findById(categoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found"));
        requireSameTenant(c.getRestaurant().getTenant().getId(), "Category");
        homeBranch().ifPresent(home -> requireHomeRestaurant(c.getRestaurant().getId(), home));
        return c;
    }

    public MenuItem item(UUID itemId) {
        MenuItem i = items.findById(itemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Menu item not found"));
        requireSameTenant(i.getCategory().getRestaurant().getTenant().getId(), "Menu item");
        homeBranch().ifPresent(home -> requireHomeRestaurant(i.getCategory().getRestaurant().getId(), home));
        return i;
    }

    public ModifierGroup modifierGroup(UUID groupId) {
        ModifierGroup g = modifierGroups.findById(groupId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Modifier group not found"));
        requireSameTenant(g.getMenuItem().getCategory().getRestaurant().getTenant().getId(), "Modifier group");
        homeBranch().ifPresent(home ->
                requireHomeRestaurant(g.getMenuItem().getCategory().getRestaurant().getId(), home));
        return g;
    }
}
