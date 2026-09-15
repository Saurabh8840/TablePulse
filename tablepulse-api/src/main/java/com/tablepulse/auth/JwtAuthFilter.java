package com.tablepulse.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final List<String> PUBLIC_PATTERNS = List.of(
            "/api/health",
            "/api/public/**",
            "/uploads/**",
            "/api/auth/register",
            "/api/auth/login",
            "/error");

    private final AntPathMatcher matcher = new AntPathMatcher();
    private final JwtUtil jwtUtil;
    private final UserRepository users;

    public JwtAuthFilter(JwtUtil jwtUtil, UserRepository users) {
        this.jwtUtil = jwtUtil;
        this.users = users;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return PUBLIC_PATTERNS.stream().anyMatch(p -> matcher.match(p, path));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            unauthorized(response, "Missing or invalid Authorization header");
            return;
        }
        String token = header.substring(7);
        Claims claims;
        try {
            claims = jwtUtil.parseClaims(token);
        } catch (JwtException | IllegalArgumentException ex) {
            unauthorized(response, "Invalid or expired token");
            return;
        }
        UUID userId;
        UUID tenantId;
        try {
            userId = UUID.fromString(claims.getSubject());
            tenantId = UUID.fromString(claims.get("tenantId", String.class));
        } catch (IllegalArgumentException ex) {
            unauthorized(response, "Invalid token claims");
            return;
        }
        var user = users.findById(userId).orElse(null);
        if (user == null || !user.isActive()
                || !user.getTenant().getId().equals(tenantId)) {
            unauthorized(response, "Invalid or expired token");
            return;
        }
        // Authority comes from the DB row, not the token claim, so role changes
        // and deactivations take effect without waiting for re-login.
        var auth = new UsernamePasswordAuthenticationToken(
                userId.toString(), null, List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
        SecurityContextHolder.getContext().setAuthentication(auth);
        TenantContext.set(tenantId);
        try {
            chain.doFilter(request, response);
        } finally {
            TenantContext.clear();
            SecurityContextHolder.clearContext();
        }
    }

    private void unauthorized(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write("{\"success\":false,\"message\":\"" + message + "\",\"data\":null}");
    }
}
