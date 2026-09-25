package com.tablepulse.restaurant;

import com.tablepulse.auth.Tenant;
import com.tablepulse.auth.TenantRepository;
import com.tablepulse.common.security.RoleGuard;
import com.tablepulse.common.security.TenantGuard;
import com.tablepulse.restaurant.dto.BranchResponse;
import com.tablepulse.restaurant.dto.CreateBranchRequest;
import com.tablepulse.restaurant.dto.CreateRestaurantRequest;
import com.tablepulse.restaurant.dto.RestaurantResponse;
import com.tablepulse.restaurant.dto.UpdateBranchRequest;
import com.tablepulse.restaurant.dto.UpdateRestaurantRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.text.Normalizer;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class RestaurantService {

    private static final long MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    private static final Map<String, String> IMAGE_EXT = Map.of(
            "image/jpeg", ".jpg", "image/png", ".png", "image/webp", ".webp");

    private final RestaurantRepository restaurants;
    private final BranchRepository branches;
    private final TenantRepository tenants;
    private final TenantGuard guard;
    private final RoleGuard roles;
    private final Path uploadDir;

    public RestaurantService(RestaurantRepository restaurants, BranchRepository branches,
                             TenantRepository tenants, TenantGuard guard, RoleGuard roles,
                             @Value("${app.upload-dir:uploads}") String uploadDir) {
        this.restaurants = restaurants;
        this.branches = branches;
        this.tenants = tenants;
        this.guard = guard;
        this.roles = roles;
        this.uploadDir = Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    @Transactional
    public RestaurantResponse createRestaurant(CreateRestaurantRequest req) {
        roles.requireOwnerOrManager();
        guard.requireTenantWide();
        UUID tenantId = TenantGuard.tenantId();
        Tenant tenant = tenants.findById(tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid tenant"));
        Restaurant r = restaurants.save(Restaurant.builder()
                .tenant(tenant)
                .name(req.getName().trim())
                .slug(uniqueSlug(req.getName()))
                .description(req.getDescription())
                .logoUrl(req.getLogoUrl())
                .coverUrl(req.getCoverUrl())
                .category(trimOrNull(req.getCategory()))
                .cuisine(trimOrNull(req.getCuisine()))
                .ownerName(trimOrNull(req.getOwnerName()))
                .ownerPhone(trimOrNull(req.getOwnerPhone()))
                .ownerEmail(trimOrNull(req.getOwnerEmail()))
                .currency(req.getCurrency() != null ? req.getCurrency().toUpperCase(Locale.ROOT) : "INR")
                .taxPercentage(orZero(req.getTaxPercentage()))
                .serviceChargePercentage(orZero(req.getServiceChargePercentage()))
                .active(true)
                .build());
        return toResponse(r);
    }

    @Transactional(readOnly = true)
    public List<RestaurantResponse> listRestaurants() {
        // Outlet-pinned staff see only their home restaurant — never the sibling outlets.
        return guard.homeBranch()
                .map(home -> List.of(toResponse(home.getRestaurant())))
                .orElseGet(() -> restaurants.findByTenantIdOrderByCreatedAtDesc(TenantGuard.tenantId())
                        .stream().map(this::toResponse).toList());
    }

    @Transactional(readOnly = true)
    public RestaurantResponse getRestaurant(UUID id) {
        return toResponse(guard.restaurant(id));
    }

    @Transactional
    public RestaurantResponse updateRestaurant(UUID id, UpdateRestaurantRequest req) {
        roles.requireOwnerOrManager();
        guard.requireTenantWide();
        Restaurant r = guard.restaurant(id);
        if (req.getName() != null && !req.getName().isBlank()) r.setName(req.getName().trim());
        if (req.getDescription() != null) r.setDescription(req.getDescription());
        if (req.getLogoUrl() != null) r.setLogoUrl(req.getLogoUrl());
        if (req.getCoverUrl() != null) r.setCoverUrl(req.getCoverUrl());
        if (req.getCategory() != null) r.setCategory(trimOrNull(req.getCategory()));
        if (req.getCuisine() != null) r.setCuisine(trimOrNull(req.getCuisine()));
        if (req.getOwnerName() != null) r.setOwnerName(trimOrNull(req.getOwnerName()));
        if (req.getOwnerPhone() != null) r.setOwnerPhone(trimOrNull(req.getOwnerPhone()));
        if (req.getOwnerEmail() != null) r.setOwnerEmail(trimOrNull(req.getOwnerEmail()));
        if (req.getCurrency() != null) r.setCurrency(req.getCurrency().toUpperCase(Locale.ROOT));
        if (req.getTaxPercentage() != null) r.setTaxPercentage(req.getTaxPercentage());
        if (req.getServiceChargePercentage() != null) r.setServiceChargePercentage(req.getServiceChargePercentage());
        if (req.getActive() != null) r.setActive(req.getActive());
        return toResponse(restaurants.save(r));
    }

    @Transactional
    public BranchResponse createBranch(UUID restaurantId, CreateBranchRequest req) {
        roles.requireOwnerOrManager();
        guard.requireTenantWide();
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
        roles.requireOwnerOrManager();
        // Home-outlet managers may edit their own outlet's profile fields.
        // Creation, tax/currency (restaurant-level) and (de)activation stay owner-only.
        if (req.getActive() != null) {
            guard.requireTenantWide();
        }
        Branch b = guard.branch(branchId);
        guard.enforceHomeBranch(b.getId());
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
                r.getLogoUrl(), r.getCoverUrl(), r.getCategory(), r.getCuisine(),
                r.getOwnerName(), r.getOwnerPhone(), r.getOwnerEmail(),
                r.getCurrency(), r.getTaxPercentage(),
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

    private String trimOrNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    // ---- Profile images (same storage pattern as menu item photos) ----

    @Transactional
    public RestaurantResponse uploadLogo(UUID id, MultipartFile file) {
        roles.requireOwnerOrManager();
        Restaurant r = guard.restaurant(id);
        r.setLogoUrl(storeProfileImage(id, "logo", file));
        return toResponse(restaurants.save(r));
    }

    @Transactional
    public RestaurantResponse uploadCover(UUID id, MultipartFile file) {
        roles.requireOwnerOrManager();
        Restaurant r = guard.restaurant(id);
        r.setCoverUrl(storeProfileImage(id, "cover", file));
        return toResponse(restaurants.save(r));
    }

    private String storeProfileImage(UUID restaurantId, String kind, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image file is required");
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image must be <= 5MB");
        }
        String ext = IMAGE_EXT.get(file.getContentType());
        if (ext == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image must be JPEG, PNG or WebP");
        }
        try {
            Files.createDirectories(uploadDir);
            String filename = "restaurant-" + restaurantId + "-" + kind + ext;
            Files.copy(file.getInputStream(), uploadDir.resolve(filename), StandardCopyOption.REPLACE_EXISTING);
            return "/uploads/" + filename;
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to store image");
        }
    }
}
