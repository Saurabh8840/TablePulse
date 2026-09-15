package com.tablepulse.restaurant;

import com.tablepulse.auth.Tenant;
import com.tablepulse.auth.TenantRepository;
import com.tablepulse.common.security.TenantGuard;
import com.tablepulse.restaurant.dto.BranchResponse;
import com.tablepulse.restaurant.dto.CreateBranchRequest;
import com.tablepulse.restaurant.dto.CreateRestaurantRequest;
import com.tablepulse.restaurant.dto.RestaurantResponse;
import com.tablepulse.restaurant.dto.UpdateBranchRequest;
import com.tablepulse.restaurant.dto.UpdateRestaurantRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class RestaurantService {

    private final RestaurantRepository restaurants;
    private final BranchRepository branches;
    private final TenantRepository tenants;
    private final TenantGuard guard;

    public RestaurantService(RestaurantRepository restaurants, BranchRepository branches,
                             TenantRepository tenants, TenantGuard guard) {
        this.restaurants = restaurants;
        this.branches = branches;
        this.tenants = tenants;
        this.guard = guard;
    }

    @Transactional
    public RestaurantResponse createRestaurant(CreateRestaurantRequest req) {
        UUID tenantId = TenantGuard.tenantId();
        Tenant tenant = tenants.findById(tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid tenant"));
        Restaurant r = restaurants.save(Restaurant.builder()
                .tenant(tenant)
                .name(req.getName().trim())
                .slug(uniqueSlug(req.getName()))
                .description(req.getDescription())
                .logoUrl(req.getLogoUrl())
                .currency(req.getCurrency() != null ? req.getCurrency().toUpperCase(Locale.ROOT) : "INR")
                .taxPercentage(orZero(req.getTaxPercentage()))
                .serviceChargePercentage(orZero(req.getServiceChargePercentage()))
                .active(true)
                .build());
        return toResponse(r);
    }

    @Transactional(readOnly = true)
    public List<RestaurantResponse> listRestaurants() {
        return restaurants.findByTenantIdOrderByCreatedAtDesc(TenantGuard.tenantId())
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public RestaurantResponse getRestaurant(UUID id) {
        return toResponse(guard.restaurant(id));
    }

    @Transactional
    public RestaurantResponse updateRestaurant(UUID id, UpdateRestaurantRequest req) {
        Restaurant r = guard.restaurant(id);
        if (req.getName() != null && !req.getName().isBlank()) r.setName(req.getName().trim());
        if (req.getDescription() != null) r.setDescription(req.getDescription());
        if (req.getLogoUrl() != null) r.setLogoUrl(req.getLogoUrl());
        if (req.getCurrency() != null) r.setCurrency(req.getCurrency().toUpperCase(Locale.ROOT));
        if (req.getTaxPercentage() != null) r.setTaxPercentage(req.getTaxPercentage());
        if (req.getServiceChargePercentage() != null) r.setServiceChargePercentage(req.getServiceChargePercentage());
        if (req.getActive() != null) r.setActive(req.getActive());
        return toResponse(restaurants.save(r));
    }

    @Transactional
    public BranchResponse createBranch(UUID restaurantId, CreateBranchRequest req) {
        Restaurant r = guard.restaurant(restaurantId);
        Branch b = branches.save(Branch.builder()
                .restaurant(r)
                .name(req.getName().trim())
                .address(req.getAddress())
                .phone(req.getPhone())
                .openingTime(parseTime(req.getOpeningTime()))
                .closingTime(parseTime(req.getClosingTime()))
                .active(true)
                .build());
        return toBranchResponse(b);
    }

    @Transactional(readOnly = true)
    public List<BranchResponse> listBranches(UUID restaurantId) {
        guard.restaurant(restaurantId);
        return branches.findByRestaurantIdOrderByCreatedAt(restaurantId)
                .stream().map(this::toBranchResponse).toList();
    }

    @Transactional
    public BranchResponse updateBranch(UUID branchId, UpdateBranchRequest req) {
        Branch b = guard.branch(branchId);
        if (req.getName() != null && !req.getName().isBlank()) b.setName(req.getName().trim());
        if (req.getAddress() != null) b.setAddress(req.getAddress());
        if (req.getPhone() != null) b.setPhone(req.getPhone());
        if (req.getOpeningTime() != null) b.setOpeningTime(parseTime(req.getOpeningTime()));
        if (req.getClosingTime() != null) b.setClosingTime(parseTime(req.getClosingTime()));
        if (req.getActive() != null) b.setActive(req.getActive());
        return toBranchResponse(branches.save(b));
    }

    private RestaurantResponse toResponse(Restaurant r) {
        return new RestaurantResponse(r.getId(), r.getName(), r.getSlug(), r.getDescription(),
                r.getLogoUrl(), r.getCurrency(), r.getTaxPercentage(),
                r.getServiceChargePercentage(), r.isActive());
    }

    private BranchResponse toBranchResponse(Branch b) {
        return new BranchResponse(b.getId(), b.getRestaurant().getId(), b.getName(), b.getAddress(),
                b.getPhone(), fmt(b.getOpeningTime()), fmt(b.getClosingTime()), b.isActive());
    }

    private String uniqueSlug(String name) {
        String base = Normalizer.normalize(name.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        if (base.isBlank()) base = "restaurant";
        if (base.length() > 40) base = base.substring(0, 40).replaceAll("-$", "");
        String slug = base;
        int n = 2;
        while (restaurants.existsBySlug(slug)) slug = base + "-" + n++;
        return slug;
    }

    private BigDecimal orZero(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    private LocalTime parseTime(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return LocalTime.parse(s.trim());
        } catch (DateTimeParseException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Time must be HH:mm, e.g. 11:00");
        }
    }

    private String fmt(LocalTime t) {
        return t != null ? t.toString().substring(0, 5) : null;
    }
}
