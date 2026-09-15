package com.tablepulse.auth;

import com.tablepulse.auth.dto.AuthResponse;
import com.tablepulse.auth.dto.ChangePasswordRequest;
import com.tablepulse.auth.dto.LoginRequest;
import com.tablepulse.auth.dto.RegisterRequest;
import com.tablepulse.auth.dto.UpdateProfileRequest;
import com.tablepulse.auth.dto.UserResponse;
import com.tablepulse.common.dto.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<UserResponse> register(@Valid @RequestBody RegisterRequest req) {
        return ApiResponse.ok("Registration successful", authService.register(req));
    }

    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest req) {
        return ApiResponse.ok("Login successful", authService.login(req));
    }

    @GetMapping("/me")
    public ApiResponse<UserResponse> me(Authentication auth) {
        return ApiResponse.ok("Profile fetched", authService.me(UUID.fromString(auth.getName())));
    }

    @PutMapping("/me")
    public ApiResponse<UserResponse> updateMe(Authentication auth,
                                              @Valid @RequestBody UpdateProfileRequest req) {
        return ApiResponse.ok("Profile updated", authService.updateMe(UUID.fromString(auth.getName()), req));
    }

    @PostMapping("/change-password")
    public ApiResponse<Void> changePassword(Authentication auth,
                                            @Valid @RequestBody ChangePasswordRequest req) {
        authService.changePassword(UUID.fromString(auth.getName()), req);
        return ApiResponse.ok("Password changed", null);
    }
}
