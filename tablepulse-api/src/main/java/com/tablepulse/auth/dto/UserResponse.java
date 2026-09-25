package com.tablepulse.auth.dto;

import com.tablepulse.auth.Role;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@AllArgsConstructor
public class UserResponse {
    private UUID userId;
    private UUID tenantId;
    private String email;
    private String fullName;
    private String phone;
    private Role role;
    private boolean active;
    private UUID branchId;
    private String branchName;
    private UUID restaurantId;
    private String restaurantName;
    private boolean seat;
    private Instant createdAt;
}
