package com.tablepulse.auth;

import com.tablepulse.auth.dto.CreateStaffRequest;
import com.tablepulse.auth.dto.ResetStaffPasswordRequest;
import com.tablepulse.auth.dto.UpdateStaffRequest;
import com.tablepulse.auth.dto.UserResponse;
import com.tablepulse.common.security.TenantGuard;
import com.tablepulse.restaurant.Branch;
import com.tablepulse.restaurant.BranchRepository;
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
 * Staff management (Phase 4, Fix 2: per-branch scoping).
 * Owner/Manager creates logins for their own tenant — no new tenant is
 * created (unlike public registration). WAITER/KITCHEN_STAFF belong to one
 * branch; MANAGER may be branch-scoped or tenant-wide (null); OWNER is
 * always tenant-wide. Fresh restaurants show 0 staff until added there.
 */
@Service
public class StaffService {

    private static final Set<Role> ALLOWED_STAFF_ROLES = Set.of(Role.MANAGER, Role.WAITER, Role.KITCHEN_STAFF);

    private final TenantRepository tenants;
    private final UserRepository users;
    private final RestaurantTableRepository tables;
    private final BranchRepository branches;
    private final TenantGuard guard;
    private final PasswordEncoder passwords;

    public StaffService(TenantRepository tenants, UserRepository users,
                        RestaurantTableRepository tables, BranchRepository branches, TenantGuard guard,
                        PasswordEncoder passwords) {
        this.tenants = tenants;
        this.users = users;
        this.tables = tables;
        this.branches = branches;
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
        // Outlet-pinned managers hire only into home outlet — a null/foreign
        // branchId must not escalate into a tenant-wide account.
        Branch branch;
        if (caller.getBranch() != null) {
            branch = caller.getBranch();
            if (req.getBranchId() != null && !req.getBranchId().equals(branch.getId())) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Branch not found");
            }
            if (req.getRole() == Role.MANAGER) {
                // Pinned managers create branch-scoped managers, never wide ones.
                req.setBranchId(branch.getId());
            }
        } else {
            branch = resolveBranchForRole(req.getRole(), req.getBranchId());
        }
        String email = req.getEmail().trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already registered");
        }
        User user = users.save(User.builder()
                .tenant(caller.getTenant())
                .branch(branch)
                .email(email)
                .passwordHash(passwords.encode(req.getPassword()))
                .fullName(req.getFullName().trim())
                .phone(req.getPhone())
                .role(req.getRole())
                .active(true)
                .seat(Boolean.TRUE.equals(req.getSeat()))
                .build());
        if (req.getTableIds() != null) {
            assignTables(user, req.getTableIds());
        }
        return toResponse(user);
    }

    @Transactional(readOnly = true)
    public List<UserResponse> list(UUID callerId) {
        return list(callerId, null, null);
    }

    @Transactional(readOnly = true)
    public List<UserResponse> list(UUID callerId, UUID branchId, UUID restaurantId) {
        User caller = requireActiveUser(callerId);
        requireManagerOrOwner();
        UUID tenantId = caller.getTenant().getId();
        // Outlet-pinned callers default to home outlet — never the tenant-wide roster.
        if (branchId == null && restaurantId == null && caller.getBranch() != null) {
            branchId = caller.getBranch().getId();
        }
        List<User> all = users.findByTenant_IdOrderByCreatedAtDesc(tenantId);
        if (branchId != null) {
            Branch b = guard.branch(branchId);
            return all.stream()
                    .filter(u -> u.getBranch() != null && u.getBranch().getId().equals(b.getId()))
                    .map(this::toResponse).toList();
        }
        if (restaurantId != null) {
            var restaurant = guard.restaurant(restaurantId);
            var branchIds = branches.findByRestaurantIdOrderByCreatedAt(restaurant.getId())
                    .stream().map(Branch::getId).collect(java.util.stream.Collectors.toSet());
            return all.stream()
                    .filter(u -> u.getBranch() != null && branchIds.contains(u.getBranch().getId()))
                    .map(this::toResponse).toList();
        }
        return all.stream().map(this::toResponse).toList();
    }

    /**
     * Owner-only password reset for outlet handover (Phase A outlet seat).
     * Rotates the secret so every previously shared copy dies at once.
     * The new password is never returned — the caller supplies it and shows
     * it to the next holder exactly once.
     */
    @Transactional
    public UserResponse resetPassword(UUID callerId, UUID staffId, ResetStaffPasswordRequest req) {
        User caller = requireActiveUser(callerId);
        requireOwner();
        User staff = users.findById(staffId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff not found"));
        if (!staff.getTenant().getId().equals(caller.getTenant().getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff not found");
        }
        if (staff.getRole() == Role.OWNER || staff.getRole() == Role.PLATFORM_ADMIN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Owner accounts cannot be reset here");
        }
        if (staff.getId().equals(caller.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use change-password for your own account");
        }
        staff.setPasswordHash(passwords.encode(req.getNewPassword()));
        return toResponse(users.save(staff));
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
        // Outlet-pinned managers act only on home-outlet staff — sibling outlet
        // staff and tenant-wide accounts are invisible to them.
        if (caller.getBranch() != null) {
            UUID staffBranchId = staff.getBranch() != null ? staff.getBranch().getId() : null;
            if (!caller.getBranch().getId().equals(staffBranchId)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff not found");
            }
        }
        if (req.getActive() == null && req.getTableIds() == null && req.getBranchId() == null) {
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
        if (req.getBranchId() != null) {
            if (staff.getRole() == Role.OWNER || staff.getRole() == Role.PLATFORM_ADMIN) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Owner accounts cannot be moved here");
            }
            Branch target = guard.branch(req.getBranchId());
            staff.setBranch(target);
            // Moving branches orphans old table ownership — clear it so the old
            // branch floor returns to house instead of leaking cross-branch.
            for (RestaurantTable t : tables.findByAssignedWaiterId(staff.getId())) {
                t.setAssignedWaiter(null);
                tables.save(t);
            }
        }
        if (req.getTableIds() != null) {
            assignTables(staff, req.getTableIds());
        }
        return toResponse(users.save(staff));
    }

    /**
     * Replaces a waiter's table ownership. Tables must belong to the staff
     * member's own branch (Fix 2); tables owned by other waiters move over
     * (rebalance) only within the same branch.
     */
    private void assignTables(User staff, List<UUID> tableIds) {
        if (staff.getRole() != Role.WAITER) {
            if (!tableIds.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only waiters can own tables");
            }
            return;
        }
        if (staff.getBranch() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Assign a branch to this waiter first");
        }
        UUID staffBranchId = staff.getBranch().getId();
        // Clear current ownership first so deselected tables return to house.
        for (RestaurantTable t : tables.findByAssignedWaiterId(staff.getId())) {
            t.setAssignedWaiter(null);
            tables.save(t);
        }
        for (UUID tableId : tableIds) {
            RestaurantTable t = guard.table(tableId);
            if (!t.getBranch().getId().equals(staffBranchId)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Table not found");
            }
            t.setAssignedWaiter(staff);
            tables.save(t);
        }
    }

    /**
     * Validates branch assignment rules per role.
     * WAITER/KITCHEN_STAFF require a branch in the caller's tenant.
     * MANAGER may pass null (all branches) or one branch.
     */
    private Branch resolveBranchForRole(Role role, UUID branchId) {
        if (role == Role.WAITER || role == Role.KITCHEN_STAFF) {
            if (branchId == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "branchId is required for " + role);
            }
            return guard.branch(branchId);
        }
        if (role == Role.MANAGER) {
            if (branchId == null) return null;
            return guard.branch(branchId);
        }
        if (branchId != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "branchId is not allowed for this role");
        }
        return null;
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

    private void requireOwner() {
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getAuthorities().stream().noneMatch(a ->
                a.getAuthority().equals("ROLE_OWNER"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only owners can reset staff passwords");
        }
    }

    private UserResponse toResponse(User user) {
        var branch = user.getBranch();
        UUID branchId = branch != null ? branch.getId() : null;
        String branchName = branch != null ? branch.getName() : null;
        UUID restaurantId = null;
        String restaurantName = null;
        if (branch != null && branch.getRestaurant() != null) {
            restaurantId = branch.getRestaurant().getId();
            restaurantName = branch.getRestaurant().getName();
        }
        return new UserResponse(
                user.getId(),
                user.getTenant().getId(),
                user.getEmail(),
                user.getFullName(),
                user.getPhone(),
                user.getRole(),
                user.isActive(),
                branchId,
                branchName,
                restaurantId,
                restaurantName,
                user.isSeat(),
                user.getCreatedAt());
    }
}
