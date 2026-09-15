package com.tablepulse.auth;

import com.tablepulse.auth.dto.CreateStaffRequest;
import com.tablepulse.auth.dto.UpdateStaffRequest;
import com.tablepulse.auth.dto.UserResponse;
import com.tablepulse.common.dto.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Staff logins — JWT required, OWNER/MANAGER only, scoped to own tenant. */
@RestController
@RequestMapping("/api/staff")
public class StaffController {

    private final StaffService staffService;

    public StaffController(StaffService staffService) {
        this.staffService = staffService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<UserResponse> create(Authentication auth,
                                            @Valid @RequestBody CreateStaffRequest req) {
        return ApiResponse.ok("Staff created", staffService.create(UUID.fromString(auth.getName()), req));
    }

    @GetMapping
    public ApiResponse<List<UserResponse>> list(Authentication auth) {
        return ApiResponse.ok("Staff fetched", staffService.list(UUID.fromString(auth.getName())));
    }

    @PatchMapping("/{id}")
    public ApiResponse<UserResponse> setActive(Authentication auth,
                                               @PathVariable UUID id,
                                               @Valid @RequestBody UpdateStaffRequest req) {
        return ApiResponse.ok("Staff updated", staffService.setActive(UUID.fromString(auth.getName()), id, req));
    }
}
