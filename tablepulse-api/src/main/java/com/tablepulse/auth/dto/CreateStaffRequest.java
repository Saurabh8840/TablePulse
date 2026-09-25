package com.tablepulse.auth.dto;

import com.tablepulse.auth.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class CreateStaffRequest {

    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    @Size(max = 255)
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 8, max = 100, message = "Password must be at least 8 characters")
    private String password;

    @NotBlank(message = "Full name is required")
    @Size(max = 100)
    private String fullName;

    @Size(max = 20)
    private String phone;

    @NotNull(message = "Role is required")
    private Role role;

    /**
     * Branch this staff belongs to (Fix 2: per-branch scoping).
     * Required for WAITER/KITCHEN_STAFF, optional for MANAGER
     * (null = all branches). Must be rejected for other roles.
     */
    private UUID branchId;

    /** Tables this waiter owns (owner assigns at setup). Only for WAITER role. */
    private List<UUID> tableIds;

    /** Mark this login as a shared restaurant seat (manager login for one location). */
    private Boolean seat;
}
