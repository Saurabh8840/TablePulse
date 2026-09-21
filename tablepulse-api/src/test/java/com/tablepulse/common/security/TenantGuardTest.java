package com.tablepulse.common.security;

import com.tablepulse.auth.Role;
import com.tablepulse.auth.Tenant;
import com.tablepulse.auth.TenantContext;
import com.tablepulse.auth.User;
import com.tablepulse.auth.UserRepository;
import com.tablepulse.menu.MenuCategory;
import com.tablepulse.menu.MenuCategoryRepository;
import com.tablepulse.menu.MenuItemRepository;
import com.tablepulse.menu.ModifierGroupRepository;
import com.tablepulse.restaurant.Branch;
import com.tablepulse.restaurant.BranchRepository;
import com.tablepulse.restaurant.Restaurant;
import com.tablepulse.restaurant.RestaurantRepository;
import com.tablepulse.table.RestaurantTable;
import com.tablepulse.table.RestaurantTableRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Phase A — outlet isolation. Branch-pinned staff resolve home entities but
 * get 404 outside home; tenant-wide callers are unaffected.
 */
@ExtendWith(MockitoExtension.class)
class TenantGuardTest {

    @Mock
    private RestaurantRepository restaurants;
    @Mock
    private BranchRepository branches;
    @Mock
    private RestaurantTableRepository tables;
    @Mock
    private MenuCategoryRepository categories;
    @Mock
    private MenuItemRepository items;
    @Mock
    private ModifierGroupRepository modifierGroups;
    @Mock
    private UserRepository users;

    private TenantGuard guard;
    private UUID tenantId;
    private Restaurant homeRestaurant;
    private Restaurant otherRestaurant;
    private Branch homeBranch;
    private Branch otherBranch;
    private RestaurantTable homeTable;
    private RestaurantTable otherTable;
    private User pinnedManager;
    private User wideOwner;
    private UUID pinnedId;
    private UUID wideId;

    @BeforeEach
    void setUp() {
        guard = new TenantGuard(restaurants, branches, tables, categories, items, modifierGroups, users);
        tenantId = UUID.randomUUID();
        TenantContext.set(tenantId);
        Tenant tenant = Tenant.builder().id(tenantId).name("T").slug("t").build();

        homeRestaurant = Restaurant.builder()
                .id(UUID.randomUUID()).tenant(tenant).name("Home").slug("home").build();
        otherRestaurant = Restaurant.builder()
                .id(UUID.randomUUID()).tenant(tenant).name("Other").slug("other").build();
        homeBranch = Branch.builder().id(UUID.randomUUID()).restaurant(homeRestaurant).name("HB").build();
        otherBranch = Branch.builder().id(UUID.randomUUID()).restaurant(otherRestaurant).name("OB").build();
        homeTable = RestaurantTable.builder()
                .id(UUID.randomUUID()).branch(homeBranch).tableNumber("T1").active(true).build();
        otherTable = RestaurantTable.builder()
                .id(UUID.randomUUID()).branch(otherBranch).tableNumber("T9").active(true).build();

        pinnedId = UUID.randomUUID();
        pinnedManager = User.builder().id(pinnedId).tenant(tenant).branch(homeBranch)
                .email("m@x.in").passwordHash("h").fullName("Manager").role(Role.MANAGER).build();
        wideId = UUID.randomUUID();
        wideOwner = User.builder().id(wideId).tenant(tenant)
                .email("o@x.in").passwordHash("h").fullName("Owner").role(Role.OWNER).build();

        // Lenient: each test exercises a different resolver path.
        lenient().when(restaurants.findById(homeRestaurant.getId())).thenReturn(Optional.of(homeRestaurant));
        lenient().when(restaurants.findById(otherRestaurant.getId())).thenReturn(Optional.of(otherRestaurant));
        lenient().when(branches.findById(homeBranch.getId())).thenReturn(Optional.of(homeBranch));
        lenient().when(branches.findById(otherBranch.getId())).thenReturn(Optional.of(otherBranch));
        lenient().when(tables.findById(homeTable.getId())).thenReturn(Optional.of(homeTable));
        lenient().when(tables.findById(otherTable.getId())).thenReturn(Optional.of(otherTable));
        lenient().when(users.findById(pinnedId)).thenReturn(Optional.of(pinnedManager));
        lenient().when(users.findById(wideId)).thenReturn(Optional.of(wideOwner));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    private void authAs(UUID userId, String role) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userId.toString(), null,
                        List.of(new SimpleGrantedAuthority(role))));
    }

    @Test
    void pinnedSeesHomeBranchRestaurantAndTable() {
        authAs(pinnedId, "ROLE_MANAGER");

        assertThat(guard.branch(homeBranch.getId())).isEqualTo(homeBranch);
        assertThat(guard.restaurant(homeRestaurant.getId())).isEqualTo(homeRestaurant);
        assertThat(guard.table(homeTable.getId())).isEqualTo(homeTable);
        assertThat(guard.homeBranch()).contains(homeBranch);
    }

    @Test
    void pinnedBlockedFromSiblingOutlet() {
        authAs(pinnedId, "ROLE_MANAGER");

        assertThatThrownBy(() -> guard.branch(otherBranch.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThatThrownBy(() -> guard.restaurant(otherRestaurant.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThatThrownBy(() -> guard.table(otherTable.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void tenantWideCallerUnaffected() {
        authAs(wideId, "ROLE_OWNER");

        assertThat(guard.branch(otherBranch.getId())).isEqualTo(otherBranch);
        assertThat(guard.restaurant(otherRestaurant.getId())).isEqualTo(otherRestaurant);
        assertThat(guard.homeBranch()).isEmpty();
    }

    @Test
    void requireTenantWideBlocksPinnedOnly() {
        authAs(pinnedId, "ROLE_MANAGER");
        assertThatThrownBy(() -> guard.requireTenantWide())
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);

        authAs(wideId, "ROLE_OWNER");
        guard.requireTenantWide();
    }

    @Test
    void anonymousSeesNoHomeBranch() {
        SecurityContextHolder.clearContext();
        assertThat(guard.homeBranch()).isEmpty();
    }

    @Test
    void pinnedCategoryOutsideHome404s() {
        authAs(pinnedId, "ROLE_MANAGER");
        MenuCategory foreign = MenuCategory.builder()
                .id(UUID.randomUUID()).restaurant(otherRestaurant).name("X").active(true).build();
        when(categories.findById(foreign.getId())).thenReturn(Optional.of(foreign));

        assertThatThrownBy(() -> guard.category(foreign.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }
}
