package com.tablepulse.menu;

import com.tablepulse.common.dto.ApiResponse;
import com.tablepulse.menu.dto.AvailabilityRequest;
import com.tablepulse.menu.dto.CreateCategoryRequest;
import com.tablepulse.menu.dto.CreateItemRequest;
import com.tablepulse.menu.dto.CreateModifierGroupRequest;
import com.tablepulse.menu.dto.CreateModifierOptionRequest;
import com.tablepulse.menu.dto.MenuDtos.CategoryResponse;
import com.tablepulse.menu.dto.MenuDtos.ItemResponse;
import com.tablepulse.menu.dto.MenuDtos.ModifierGroupResponse;
import com.tablepulse.menu.dto.MenuDtos.ModifierOptionResponse;
import com.tablepulse.menu.dto.UpdateCategoryRequest;
import com.tablepulse.menu.dto.UpdateItemRequest;
import com.tablepulse.menu.dto.UpdateModifierGroupRequest;
import com.tablepulse.menu.dto.UpdateModifierOptionRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class MenuController {

    private final MenuService service;

    public MenuController(MenuService service) {
        this.service = service;
    }

    @PostMapping("/restaurants/{id}/categories")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<CategoryResponse> createCategory(@PathVariable UUID id,
                                                        @Valid @RequestBody CreateCategoryRequest req) {
        return ApiResponse.ok("Category created", service.createCategory(id, req));
    }

    @GetMapping("/restaurants/{id}/categories")
    public ApiResponse<List<CategoryResponse>> listCategories(@PathVariable UUID id) {
        return ApiResponse.ok("Categories fetched", service.listCategories(id));
    }

    @PutMapping("/categories/{id}")
    public ApiResponse<CategoryResponse> updateCategory(@PathVariable UUID id,
                                                        @Valid @RequestBody UpdateCategoryRequest req) {
        return ApiResponse.ok("Category updated", service.updateCategory(id, req));
    }

    @DeleteMapping("/categories/{id}")
    public ApiResponse<Void> deleteCategory(@PathVariable UUID id) {
        service.deleteCategory(id);
        return ApiResponse.ok("Category deactivated", null);
    }

    @PostMapping("/categories/{id}/items")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ItemResponse> createItem(@PathVariable UUID id,
                                                @Valid @RequestBody CreateItemRequest req) {
        return ApiResponse.ok("Menu item created", service.createItem(id, req));
    }

    @GetMapping("/categories/{id}/items")
    public ApiResponse<List<ItemResponse>> listItems(@PathVariable UUID id) {
        return ApiResponse.ok("Menu items fetched", service.listItems(id));
    }

    @PutMapping("/items/{id}")
    public ApiResponse<ItemResponse> updateItem(@PathVariable UUID id,
                                                @Valid @RequestBody UpdateItemRequest req) {
        return ApiResponse.ok("Menu item updated", service.updateItem(id, req));
    }

    @PatchMapping("/items/{id}/availability")
    public ApiResponse<ItemResponse> setAvailability(Authentication auth,
                                                     @PathVariable UUID id,
                                                     @Valid @RequestBody AvailabilityRequest req) {
        return ApiResponse.ok("Availability updated",
                service.setAvailability(UUID.fromString(auth.getName()), id, req));
    }

    @PostMapping(value = "/items/{id}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ItemResponse> uploadImage(@PathVariable UUID id,
                                                 @RequestParam("file") MultipartFile file) {
        return ApiResponse.ok("Image uploaded", service.uploadImage(id, file));
    }

    @DeleteMapping("/items/{id}/image")
    public ApiResponse<ItemResponse> deleteImage(@PathVariable UUID id) {
        return ApiResponse.ok("Image removed", service.deleteImage(id));
    }

    @DeleteMapping("/items/{id}")
    public ApiResponse<Void> deleteItem(@PathVariable UUID id) {
        service.deleteItem(id);
        return ApiResponse.ok("Menu item deactivated", null);
    }

    @GetMapping("/items/{id}/modifier-groups")
    public ApiResponse<List<ModifierGroupResponse>> listModifierGroups(@PathVariable UUID id) {
        return ApiResponse.ok("Modifier groups fetched", service.listModifierGroups(id));
    }

    @PostMapping("/items/{id}/modifier-groups")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ModifierGroupResponse> createModifierGroup(@PathVariable UUID id,
                                                                  @Valid @RequestBody CreateModifierGroupRequest req) {
        return ApiResponse.ok("Modifier group created", service.createModifierGroup(id, req));
    }

    @PostMapping("/modifier-groups/{id}/options")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ModifierOptionResponse> createModifierOption(@PathVariable UUID id,
                                                                    @Valid @RequestBody CreateModifierOptionRequest req) {
        return ApiResponse.ok("Modifier option created", service.createModifierOption(id, req));
    }

    @PutMapping("/modifier-groups/{id}")
    public ApiResponse<ModifierGroupResponse> updateModifierGroup(@PathVariable UUID id,
                                                                  @Valid @RequestBody UpdateModifierGroupRequest req) {
        return ApiResponse.ok("Modifier group updated", service.updateModifierGroup(id, req));
    }

    @DeleteMapping("/modifier-groups/{id}")
    public ApiResponse<Void> deleteModifierGroup(@PathVariable UUID id) {
        service.deleteModifierGroup(id);
        return ApiResponse.ok("Modifier group deleted", null);
    }

    @PutMapping("/modifier-options/{id}")
    public ApiResponse<ModifierOptionResponse> updateModifierOption(@PathVariable UUID id,
                                                                    @Valid @RequestBody UpdateModifierOptionRequest req) {
        return ApiResponse.ok("Modifier option updated", service.updateModifierOption(id, req));
    }

    @PatchMapping("/modifier-options/{id}/availability")
    public ApiResponse<ModifierOptionResponse> setModifierOptionAvailability(@PathVariable UUID id,
                                                                             @Valid @RequestBody AvailabilityRequest req) {
        return ApiResponse.ok("Modifier availability updated", service.setModifierOptionAvailability(id, req));
    }

    @DeleteMapping("/modifier-options/{id}")
    public ApiResponse<Void> deleteModifierOption(@PathVariable UUID id) {
        service.deleteModifierOption(id);
        return ApiResponse.ok("Modifier option deleted", null);
    }
}
