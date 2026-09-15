package com.tablepulse.menu;

import com.tablepulse.common.security.TenantGuard;
import com.tablepulse.menu.dto.AvailabilityRequest;
import com.tablepulse.menu.dto.CreateCategoryRequest;
import com.tablepulse.menu.dto.CreateItemRequest;
import com.tablepulse.menu.dto.CreateModifierGroupRequest;
import com.tablepulse.menu.dto.CreateModifierOptionRequest;
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
    private final TenantGuard guard;
    private final Path uploadDir;

    public MenuService(MenuCategoryRepository categories, MenuItemRepository items,
                       ModifierGroupRepository groups, ModifierOptionRepository options,
                       RestaurantRepository restaurants, TenantGuard guard,
                       @Value("${app.upload-dir:uploads}") String uploadDir) {
        this.categories = categories;
        this.items = items;
        this.groups = groups;
        this.options = options;
        this.restaurants = restaurants;
        this.guard = guard;
        this.uploadDir = Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    // ---- Categories ----

    @Transactional
    public CategoryResponse createCategory(UUID restaurantId, CreateCategoryRequest req) {
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
        MenuCategory c = guard.category(categoryId);
        if (req.getName() != null && !req.getName().isBlank()) c.setName(req.getName().trim());
        if (req.getDescription() != null) c.setDescription(req.getDescription());
        if (req.getDisplayOrder() != null) c.setDisplayOrder(req.getDisplayOrder());
        if (req.getActive() != null) c.setActive(req.getActive());
        return toCategory(categories.save(c));
    }

    @Transactional
    public void deleteCategory(UUID categoryId) {
        MenuCategory c = guard.category(categoryId);
        c.setActive(false);
        categories.save(c);
    }

    // ---- Items ----

    @Transactional
    public ItemResponse createItem(UUID categoryId, CreateItemRequest req) {
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

    @Transactional
    public ItemResponse setAvailability(UUID itemId, AvailabilityRequest req) {
        MenuItem i = guard.item(itemId);
        i.setAvailable(req.getAvailable());
        return toItem(items.save(i));
    }

    @Transactional
    public void deleteItem(UUID itemId) {
        MenuItem i = guard.item(itemId);
        i.setActive(false);
        items.save(i);
    }

    @Transactional
    public ItemResponse uploadImage(UUID itemId, MultipartFile file) {
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
        MenuItem i = guard.item(itemId);
        if (req.getMaxSelections() < Math.max(req.getMinSelections(), req.isRequired() ? 1 : 0)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "maxSelections must cover minSelections");
        }
        ModifierGroup g = groups.save(ModifierGroup.builder()
                .menuItem(i)
                .name(req.getName().trim())
                .required(req.isRequired())
                .minSelections(req.isRequired() ? Math.max(req.getMinSelections(), 1) : req.getMinSelections())
                .maxSelections(req.getMaxSelections())
                .displayOrder(req.getDisplayOrder())
                .build());
        return toGroup(g, List.of());
    }

    @Transactional
    public ModifierOptionResponse createModifierOption(UUID groupId, CreateModifierOptionRequest req) {
        ModifierGroup g = guard.modifierGroup(groupId);
        ModifierOption o = options.save(ModifierOption.builder()
                .group(g)
                .name(req.getName().trim())
                .additionalPrice(req.getAdditionalPrice() != null ? req.getAdditionalPrice() : BigDecimal.ZERO)
                .defaultOption(req.isDefaultOption())
                .available(req.isAvailable())
                .displayOrder(req.getDisplayOrder())
                .build());
        return toOption(o);
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
                i.getPreparationTimeMinutes(), i.getDisplayOrder(), i.isActive());
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
                r.getCurrency(), r.getTaxPercentage(), r.getServiceChargePercentage());
    }
}
