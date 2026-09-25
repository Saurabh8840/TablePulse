package com.tablepulse.auth;

import com.tablepulse.auth.dto.AuthResponse;
import com.tablepulse.auth.dto.ChangePasswordRequest;
import com.tablepulse.auth.dto.LoginRequest;
import com.tablepulse.auth.dto.RegisterRequest;
import com.tablepulse.auth.dto.UpdateProfileRequest;
import com.tablepulse.auth.dto.UserResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.text.Normalizer;
import java.util.Locale;
import java.util.UUID;

@Service
public class AuthService {

    private final TenantRepository tenants;
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final JwtUtil jwtUtil;

    public AuthService(TenantRepository tenants, UserRepository users,
                       PasswordEncoder passwords, JwtUtil jwtUtil) {
        this.tenants = tenants;
        this.users = users;
        this.passwords = passwords;
        this.jwtUtil = jwtUtil;
    }

    @Transactional
    public UserResponse register(RegisterRequest req) {
        String email = req.getEmail().trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already registered");
        }
        String slug = uniqueSlug(req.getBusinessName());
        Tenant tenant = tenants.save(Tenant.builder()
                .name(req.getBusinessName().trim())
                .slug(slug)
                .status("ACTIVE")
                .build());
        User user = users.save(User.builder()
                .tenant(tenant)
                .email(email)
                .passwordHash(passwords.encode(req.getPassword()))
                .fullName(req.getFullName().trim())
                .phone(req.getPhone())
                .role(Role.OWNER)
                .active(true)
                .build());
        return toResponse(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest req) {
        String email = req.getEmail().trim().toLowerCase(Locale.ROOT);
        User user = users.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));
        if (!user.isActive()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account is disabled");
        }
        if (!passwords.matches(req.getPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }
        String token = jwtUtil.generateToken(user.getId(), user.getTenant().getId(), user.getRole());
        return new AuthResponse(token, jwtUtil.getExpirationSeconds(), toResponse(user));
    }

    @Transactional(readOnly = true)
    public UserResponse me(UUID userId) {
        return toResponse(requireUser(userId));
    }

    @Transactional
    public UserResponse updateMe(UUID userId, UpdateProfileRequest req) {
        User user = requireUser(userId);
        if (req.getFullName() != null && !req.getFullName().isBlank()) {
            user.setFullName(req.getFullName().trim());
        }
        if (req.getPhone() != null) {
            user.setPhone(req.getPhone().isBlank() ? null : req.getPhone().trim());
        }
        return toResponse(users.save(user));
    }

    @Transactional
    public void changePassword(UUID userId, ChangePasswordRequest req) {
        User user = requireUser(userId);
        if (!passwords.matches(req.getCurrentPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Current password is incorrect");
        }
        user.setPasswordHash(passwords.encode(req.getNewPassword()));
        users.save(user);
    }

    private User requireUser(UUID userId) {
        User user = users.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired token"));
        if (!user.isActive()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account is disabled");
        }
        return user;
    }

    private String uniqueSlug(String businessName) {
        String base = Normalizer.normalize(businessName.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        if (base.isBlank()) {
            base = "restaurant";
        }
        if (base.length() > 40) {
            base = base.substring(0, 40).replaceAll("-$", "");
        }
        String slug = base;
        int n = 2;
        while (tenants.existsBySlug(slug)) {
            slug = base + "-" + n++;
        }
        return slug;
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
