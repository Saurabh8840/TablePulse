package com.tablepulse.auth;

import com.tablepulse.auth.dto.CreateStaffRequest;
import com.tablepulse.auth.dto.UpdateStaffRequest;
import com.tablepulse.auth.dto.UserResponse;
import com.tablepulse.common.security.TenantGuard;
import com.tablepulse.table.RestaurantTable;
import com.tablepulse.table.RestaurantTableRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Staff management (Phase 4). Owner/Manager creates logins for their own
 * tenant — no new tenant is created (unlike public registration).
 * Users table already has role + is_active, so no migration is needed.
 */
@Service
public class StaffService {

    private static final Set<Role> ALLOWED_STAFF_ROLES = Set.of(Role.MANAGER, Role.WAITER, Role.KITCHEN_STAFF);

    private final TenantRepository tenants;
    private final UserRepository users;
    private final RestaurantTableRepository tables;
    private final TenantGuard guard;
    private final PasswordEncoder passwords;

    public StaffService(TenantRepository tenants, UserRepository users,
                        RestaurantTableRepository tables, TenantGuard guard,
                        PasswordEncoder passwords) {
        this.tenants = tenants;
        this.users = users;
        this.tables = tables;
        this.guard = guard;
        this.passwords = passwords;
    }

    @Transactional
    public UserResponse create(UUID callerId, CreateStaffRequest req) {
        User caller = requireActiveUser(callerId);
        requireManagerOrOwner();
        if (!ALLOWED_STAFF_ROLES.contains(req.getRole())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Role must be one of MANAGER, WAITER, KITCHEN_STAFF");
        }
        String email = req.getEmail().trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already registered");
        }
        User user = users.save(User.builder()
                .tenant(caller.getTenant())
                .email(email)
                .passwordHash(passwords.encode(req.getPassword()))
                .fullName(req.getFullName().trim())
                .phone(req.getPhone())
                .role(req.getRole())
                .active(true)
                .build());
        if (req.getTableIds() != null) {
            assignTables(user, req.getTableIds());
        }
        return toResponse(user);
    }

    @Transactional(readOnly = true)
    public List<UserResponse> list(UUID callerId) {
        User caller = requireActiveUser(callerId);
        requireManagerOrOwner();
        UUID tenantId = caller.getTenant().getId();
        return users.findByTenant_IdOrderByCreatedAtDesc(tenantId).stream()
                .map(this::toResponse).toList();
    }

    @Transactional
    public UserResponse setActive(UUID callerId, UUID staffId, UpdateStaffRequest req) {
        User caller = requireActiveUser(callerId);
        requireManagerOrOwner();
        User staff = users.findById(staffId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff not found"));
        if (!staff.getTenant().getId().equals(caller.getTenant().getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff not found");
        }
        if (req.getActive() == null && req.getTableIds() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nothing to update");
        }
        if (req.getActive() != null) {
            if (staff.getId().equals(caller.getId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot deactivate yourself");
            }
            if (staff.getRole() == Role.OWNER || staff.getRole() == Role.PLATFORM_ADMIN) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Owner accounts cannot be deactivated here");
            }
            staff.setActive(req.getActive());
        }
        if (req.getTableIds() != null) {
            assignTables(staff, req.getTableIds());
        }
        return toResponse(users.save(staff));
    }

    /**
     * Replaces a waiter's table ownership. Tables must belong to the staff
     * member's tenant; tables owned by other waiters move over (rebalance).
     */
    private void assignTables(User staff, List<UUID> tableIds) {
        if (staff.getRole() != Role.WAITER) {
            if (!tableIds.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only waiters can own tables");
            }
            return;
        }
        UUID tenantId = staff.getTenant().getId();
        // Clear current ownership first so deselected tables return to house.
        for (RestaurantTable t : tables.findByAssignedWaiterId(staff.getId())) {
            t.setAssignedWaiter(null);
            tables.save(t);
        }
        for (UUID tableId : tableIds) {
            RestaurantTable t = guard.table(tableId);
            if (!t.getBranch().getRestaurant().getTenant().getId().equals(tenantId)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Table not found");
            }
            t.setAssignedWaiter(staff);
            tables.save(t);
        }
    }

    private User requireActiveUser(UUID userId) {
        User user = users.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired token"));
        if (!user.isActive()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account is disabled");
        }
        return user;
    }

    private void requireManagerOrOwner() {
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getAuthorities().stream().noneMatch(a ->
                a.getAuthority().equals("ROLE_OWNER") || a.getAuthority().equals("ROLE_MANAGER"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only owners and managers can manage staff");
        }
    }

    private UserResponse toResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getTenant().getId(),
                user.getEmail(),
                user.getFullName(),
                user.getPhone(),
                user.getRole(),
                user.isActive());
    }
}
