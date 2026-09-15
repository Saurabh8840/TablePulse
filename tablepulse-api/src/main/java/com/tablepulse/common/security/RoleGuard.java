package com.tablepulse.common.security;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Central role enforcement. Controllers/services call these before mutating
 * owner-managed resources (restaurants, branches, tables, menu config).
 * Reads stay open to all authenticated staff; order-flow roles live in
 * OrderService/WaiterService where transitions need finer rules.
 */
@Component
public class RoleGuard {

    public void requireOwnerOrManager() {
        if (!hasAny("ROLE_OWNER", "ROLE_MANAGER")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only owners and managers can do this");
        }
    }

    public void requireAnyStaff() {
        if (!hasAny("ROLE_OWNER", "ROLE_MANAGER", "ROLE_WAITER", "ROLE_KITCHEN_STAFF")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff access required");
        }
    }

    public boolean hasAny(String... roles) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        for (String r : roles) {
            if (auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals(r))) return true;
        }
        return false;
    }
}
