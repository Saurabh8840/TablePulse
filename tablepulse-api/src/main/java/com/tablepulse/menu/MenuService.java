package com.tablepulse.menu;

import com.tablepulse.auth.User;
import com.tablepulse.auth.UserRepository;
import com.tablepulse.common.security.RoleGuard;
import com.tablepulse.common.security.TenantGuard;
import com.tablepulse.menu.dto.AvailabilityRequest;
import com.tablepulse.menu.dto.CreateCategoryRequest;
import com.tablepulse.menu.dto.CreateItemRequest;
import com.tablepulse.menu.dto.CreateModifierGroupRequest;
import com.tablepulse.menu.dto.CreateModifierOptionRequest;
import com.tablepulse.menu.dto.UpdateModifierGroupRequest;
import com.tablepulse.menu.dto.UpdateModifierOptionRequest;
import com.tablepulse.menu.dto.MenuDtos.CategoryResponse;
import com.tablepulse.menu.dto.MenuDtos.FullMenu;
import com.tablepulse.menu.dto.MenuDtos.ItemResponse;
import com.tablepulse.menu.dto.MenuDtos.ModifierGroupResponse;
import com.tablepulse.menu.dto.MenuDtos.ModifierOptionResponse;
import com.tablepulse.menu.dto.MenuDtos.PublicCategory;
import com.tablepulse.menu.dto.MenuDtos.PublicItem;
import com.tablepulse.menu.dto.MenuDtos.RestaurantInfo;
import com.tablepulse.menu.dto.UpdateCategoryRequest;
import com.tablepulse.menu.dto.UpdateItemRequest;
import com.tablepulse.restaurant.Restaurant;
import com.tablepulse.restaurant.RestaurantRepository;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class MenuService {

    private static final long MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    private static final Map<String, String> IMAGE_EXT = Map.of(
            "image/jpeg", ".jpg", "image/png", ".png", "image/webp", ".webp");

    private final MenuCategoryRepository categories;
    private final MenuItemRepository items;
    private final ModifierGroupRepository groups;
    private final ModifierOptionRepository options;
    private final RestaurantRepository restaurants;
    private final UserRepository users;
    private final TenantGuard guard;
    private final RoleGuard roles;
    private final Path uploadDir;

    public MenuService(MenuCategoryRepository categories, MenuItemRepository items,
                       ModifierGroupRepository groups, ModifierOptionRepository options,
                       RestaurantRepository restaurants, UserRepository users,
                       TenantGuard guard, RoleGuard roles,
                       @Value("${app.upload-dir:uploads}") String uploadDir) {
        this.categories = categories;
        this.items = items;
        this.groups = groups;
        this.options = options;
        this.restaurants = restaurants;
        this.users = users;
        this.guard = guard;
        this.roles = roles;
        this.uploadDir = Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    // ---- Categories ----

    @Transactional
    public CategoryResponse createCategory(UUID restaurantId, CreateCategoryRequest req) {
        roles.requireOwnerOrManager();
        Restaurant r = guard.restaurant(restaurantId);
        MenuCategory c = categories.save(MenuCategory.builder()
                .restaurant(r)
                .name(req.getName().trim())
                .description(req.getDescription())
                .displayOrder(req.getDisplayOrder())
                .active(true)
                .build());
        return toCategory(c);
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> listCategories(UUID restaurantId) {
        guard.restaurant(restaurantId);
        return categories.findByRestaurantIdOrderByDisplayOrderAsc(restaurantId)
                .stream().map(this::toCategory).toList();
    }

    @Transactional
    public CategoryResponse updateCategory(UUID categoryId, UpdateCategoryRequest req) {
        roles.requireOwnerOrManager();
        MenuCategory c = guard.category(categoryId);
        if (req.getName() != null && !req.getName().isBlank()) c.setName(req.getName().trim());
        if (req.getDescription() != null) c.setDescription(req.getDescription());
        if (req.getDisplayOrder() != null) c.setDisplayOrder(req.getDisplayOrder());
        if (req.getActive() != null) c.setActive(req.getActive());
        return toCategory(categories.save(c));
    }

    @Transactional
    public void deleteCategory(UUID categoryId) {
        roles.requireOwnerOrManager();
        MenuCategory c = guard.category(categoryId);
        c.setActive(false);
        categories.save(c);
    }

    // ---- Items ----

    @Transactional
    public ItemResponse createItem(UUID categoryId, CreateItemRequest req) {
        roles.requireOwnerOrManager();
        MenuCategory c = guard.category(categoryId);
        MenuItem i = items.save(MenuItem.builder()
                .category(c)
                .name(req.getName().trim())
                .description(req.getDescription())
                .price(req.getPrice())
                .vegetarian(req.isVegetarian())
                .available(true)
                .preparationTimeMinutes(req.getPreparationTimeMinutes())
                .displayOrder(req.getDisplayOrder())
                .active(true)
                .build());
        return toItem(i);
    }

    @Transactional(readOnly = true)
    public List<ItemResponse> listItems(UUID categoryId) {
        guard.category(categoryId);
        return items.findByCategoryIdOrderByDisplayOrderAsc(categoryId)
                .stream().map(this::toItem).toList();
    }

    @Transactional
    public ItemResponse updateItem(UUID itemId, UpdateItemRequest req) {
        roles.requireOwnerOrManager();
        MenuItem i = guard.item(itemId);
        if (req.getName() != null && !req.getName().isBlank()) i.setName(req.getName().trim());
        if (req.getDescription() != null) i.setDescription(req.getDescription());
        if (req.getPrice() != null) i.setPrice(req.getPrice());
        if (req.getVegetarian() != null) i.setVegetarian(req.getVegetarian());
        if (req.getAvailable() != null) i.setAvailable(req.getAvailable());
        if (req.getPreparationTimeMinutes() != null) i.setPreparationTimeMinutes(req.getPreparationTimeMinutes());
        if (req.getDisplayOrder() != null) i.setDisplayOrder(req.getDisplayOrder());
        if (req.getActive() != null) i.setActive(req.getActive());
        return toItem(items.save(i));
    }

    /**
     * Availability toggle (86-ing). Open to all staff — kitchen owns this during
     * service — and records who flipped it so the owner sees attribution.
     */
    @Transactional
    public ItemResponse setAvailability(UUID callerId, UUID itemId, AvailabilityRequest req) {
        roles.requireAnyStaff();
        MenuItem i = guard.item(itemId);
        User caller = users.findById(callerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired token"));
        i.setAvailable(req.getAvailable());
        i.setUpdatedBy(caller);
        return toItem(items.save(i));
    }

    @Transactional
    public void deleteItem(UUID itemId) {
        roles.requireOwnerOrManager();
        MenuItem i = guard.item(itemId);
        i.setActive(false);
        items.save(i);
    }

    @Transactional
    public ItemResponse uploadImage(UUID itemId, MultipartFile file) {
        roles.requireOwnerOrManager();
        MenuItem i = guard.item(itemId);
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
            String filename = "item-" + itemId + ext;
            Files.copy(file.getInputStream(), uploadDir.resolve(filename), StandardCopyOption.REPLACE_EXISTING);
            i.setImageUrl("/uploads/" + filename);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to store image");
        }
        return toItem(items.save(i));
    }

    @Transactional
    public ItemResponse deleteImage(UUID itemId) {
        roles.requireOwnerOrManager();
        MenuItem i = guard.item(itemId);
        if (i.getImageUrl() != null) {
            try {
                String name = Paths.get(i.getImageUrl()).getFileName().toString();
                // Only delete files we created (item-<id>.*) to avoid path tricks.
                if (name.startsWith("item-" + itemId)) {
                    Files.deleteIfExists(uploadDir.resolve(name));
                }
            } catch (IOException ignored) {
                // best-effort: still clear the URL even if file delete fails
            }
            i.setImageUrl(null);
        }
        return toItem(items.save(i));
    }

    // ---- Modifiers ----

    @Transactional
    public ModifierGroupResponse createModifierGroup(UUID itemId, CreateModifierGroupRequest req) {
        roles.requireOwnerOrManager();
        MenuItem i = guard.item(itemId);
        if (req.getMaxSelections() < Math.max(req.getMinSelections(), req.isRequired() ? 1 : 0)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "maxSelections must cover minSelections");
        }
        String name = req.getName().trim();
        if (groups.existsByMenuItemIdAndNameIgnoreCase(itemId, name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A group with this name already exists for this item");
        }
        ModifierGroup g = groups.save(ModifierGroup.builder()
                .menuItem(i)
                .name(name)
                .required(req.isRequired())
                .minSelections(req.isRequired() ? Math.max(req.getMinSelections(), 1) : req.getMinSelections())
                .maxSelections(req.getMaxSelections())
                .displayOrder(req.getDisplayOrder())
                .build());
        return toGroup(g, List.of());
    }

    @Transactional
    public ModifierGroupResponse updateModifierGroup(UUID groupId, UpdateModifierGroupRequest req) {
        roles.requireOwnerOrManager();
        ModifierGroup g = guard.modifierGroup(groupId);
        if (req.getName() != null && !req.getName().isBlank()) {
            String name = req.getName().trim();
            if (!name.equalsIgnoreCase(g.getName())
                    && groups.existsByMenuItemIdAndNameIgnoreCase(g.getMenuItem().getId(), name)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "A group with this name already exists for this item");
            }
            g.setName(name);
        }
        if (req.getRequired() != null) g.setRequired(req.getRequired());
        if (req.getMinSelections() != null) g.setMinSelections(req.getMinSelections());
        if (req.getMaxSelections() != null) g.setMaxSelections(req.getMaxSelections());
        if (req.getDisplayOrder() != null) g.setDisplayOrder(req.getDisplayOrder());
        // Re-validate + coerce like create (Fix 3: variant mode forces required max 1).
        if (g.getMaxSelections() < Math.max(g.getMinSelections(), g.isRequired() ? 1 : 0)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "maxSelections must cover minSelections");
        }
        if (g.isRequired()) g.setMinSelections(Math.max(g.getMinSelections(), 1));
        return toGroup(groups.save(g),
                options.findByGroupIdOrderByDisplayOrderAsc(g.getId()).stream().map(this::toOption).toList());
    }

    @Transactional
    public void deleteModifierGroup(UUID groupId) {
        roles.requireOwnerOrManager();
        ModifierGroup g = guard.modifierGroup(groupId);
        // Hard delete group + options — orders snapshot names/prices, so history is kept.
        options.findByGroupId(g.getId()).forEach(options::delete);
        groups.delete(g);
    }

    @Transactional
    public ModifierOptionResponse createModifierOption(UUID groupId, CreateModifierOptionRequest req) {
        roles.requireOwnerOrManager();
        ModifierGroup g = guard.modifierGroup(groupId);
        String name = req.getName().trim();
        if (options.existsByGroupIdAndNameIgnoreCase(groupId, name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An option with this name already exists in this group");
        }
        ModifierOption o = options.save(ModifierOption.builder()
                .group(g)
                .name(name)
                .additionalPrice(req.getAdditionalPrice() != null ? req.getAdditionalPrice() : BigDecimal.ZERO)
                .defaultOption(req.isDefaultOption())
                .available(req.isAvailable())
                .displayOrder(req.getDisplayOrder())
                .build());
        if (o.isDefaultOption()) clearOtherDefaults(g.getId(), o.getId());
        return toOption(o);
    }

    @Transactional
    public ModifierOptionResponse updateModifierOption(UUID optionId, UpdateModifierOptionRequest req) {
        roles.requireOwnerOrManager();
        ModifierOption o = options.findById(optionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Modifier option not found"));
        guard.modifierGroup(o.getGroup().getId()); // tenant check
        if (req.getName() != null && !req.getName().isBlank()) {
            String name = req.getName().trim();
            if (!name.equalsIgnoreCase(o.getName())
                    && options.existsByGroupIdAndNameIgnoreCase(o.getGroup().getId(), name)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "An option with this name already exists in this group");
            }
            o.setName(name);
        }
        if (req.getAdditionalPrice() != null) o.setAdditionalPrice(req.getAdditionalPrice());
        if (req.getAvailable() != null) o.setAvailable(req.getAvailable());
        if (req.getDisplayOrder() != null) o.setDisplayOrder(req.getDisplayOrder());
        if (req.getDefaultOption() != null) o.setDefaultOption(req.getDefaultOption());
        ModifierOption saved = options.save(o);
        if (saved.isDefaultOption()) clearOtherDefaults(saved.getGroup().getId(), saved.getId());
        return toOption(saved);
    }

    @Transactional
    public ModifierOptionResponse setModifierOptionAvailability(UUID optionId, AvailabilityRequest req) {
        roles.requireAnyStaff();
        ModifierOption o = options.findById(optionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Modifier option not found"));
        guard.modifierGroup(o.getGroup().getId()); // tenant check
        o.setAvailable(req.getAvailable());
        return toOption(options.save(o));
    }

    @Transactional
    public void deleteModifierOption(UUID optionId) {
        roles.requireOwnerOrManager();
        ModifierOption o = options.findById(optionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Modifier option not found"));
        guard.modifierGroup(o.getGroup().getId()); // tenant check
        options.delete(o);
    }

    /** Only one default per group — used for S/M/L pre-select (Fix 3). */
    private void clearOtherDefaults(UUID groupId, UUID keepId) {
        for (ModifierOption other : options.findByGroupId(groupId)) {
            if (!other.getId().equals(keepId) && other.isDefaultOption()) {
                other.setDefaultOption(false);
                options.save(other);
            }
        }
    }

    @Transactional(readOnly = true)
    public List<ModifierGroupResponse> listModifierGroups(UUID itemId) {
        guard.item(itemId);
        return groupsFor(itemId);
    }

    // ---- Public (no auth) ----

    @Transactional(readOnly = true)
    public RestaurantInfo publicRestaurant(String slug) {
        return toInfo(publicRestaurantBySlug(slug));
    }

    @Transactional(readOnly = true)
    public FullMenu publicMenu(String slug) {
        Restaurant r = publicRestaurantBySlug(slug);
        List<PublicCategory> cats = new ArrayList<>();
        for (MenuCategory c : categories.findByRestaurantIdOrderByDisplayOrderAsc(r.getId())) {
            if (!c.isActive()) continue;
            List<PublicItem> list = new ArrayList<>();
            for (MenuItem i : items.findByCategoryIdOrderByDisplayOrderAsc(c.getId())) {
                if (!i.isActive()) continue;
                list.add(new PublicItem(i.getId(), i.getName(), i.getDescription(), i.getPrice(),
                        i.getImageUrl(), i.isVegetarian(), i.isAvailable(),
                        i.getPreparationTimeMinutes(), groupsFor(i.getId())));
            }
            cats.add(new PublicCategory(c.getId(), c.getName(), c.getDescription(), list));
        }
        return new FullMenu(toInfo(r), cats);
    }

    private Restaurant publicRestaurantBySlug(String slug) {
        Restaurant r = restaurants.findBySlug(slug)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Restaurant not found"));
        if (!r.isActive()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Restaurant not found");
        }
        return r;
    }

    private List<ModifierGroupResponse> groupsFor(UUID itemId) {
        List<ModifierGroupResponse> out = new ArrayList<>();
        for (ModifierGroup g : groups.findByMenuItemIdOrderByDisplayOrderAsc(itemId)) {
            List<ModifierOptionResponse> opts = options.findByGroupIdOrderByDisplayOrderAsc(g.getId())
                    .stream().map(this::toOption).toList();
            out.add(toGroup(g, opts));
        }
        return out;
    }

    private CategoryResponse toCategory(MenuCategory c) {
        return new CategoryResponse(c.getId(), c.getRestaurant().getId(), c.getName(),
                c.getDescription(), c.getDisplayOrder(), c.isActive());
    }

    private ItemResponse toItem(MenuItem i) {
        return new ItemResponse(i.getId(), i.getCategory().getId(), i.getName(), i.getDescription(),
                i.getPrice(), i.getImageUrl(), i.isVegetarian(), i.isAvailable(),
                i.getPreparationTimeMinutes(), i.getDisplayOrder(), i.isActive(),
                i.getUpdatedBy() != null ? i.getUpdatedBy().getFullName() : null,
                i.getUpdatedAt());
    }

    private ModifierGroupResponse toGroup(ModifierGroup g, List<ModifierOptionResponse> opts) {
        return new ModifierGroupResponse(g.getId(), g.getMenuItem().getId(), g.getName(),
                g.isRequired(), g.getMinSelections(), g.getMaxSelections(), g.getDisplayOrder(), opts);
    }

    private ModifierOptionResponse toOption(ModifierOption o) {
        return new ModifierOptionResponse(o.getId(), o.getName(), o.getAdditionalPrice(),
                o.isDefaultOption(), o.isAvailable(), o.getDisplayOrder());
    }

    private RestaurantInfo toInfo(Restaurant r) {
        return new RestaurantInfo(r.getName(), r.getSlug(), r.getDescription(), r.getLogoUrl(),
                r.getCoverUrl(), r.getCurrency(), r.getTaxPercentage(), r.getServiceChargePercentage());
    }
}
