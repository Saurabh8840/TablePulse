package com.tablepulse.menu;

import com.tablepulse.common.dto.ApiResponse;
import com.tablepulse.menu.dto.MenuDtos.FullMenu;
import com.tablepulse.menu.dto.MenuDtos.RestaurantInfo;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Customer-facing APIs — no authentication (guests scan QR). */
@RestController
@RequestMapping("/api/public/restaurants")
public class PublicMenuController {

    private final MenuService service;

    public PublicMenuController(MenuService service) {
        this.service = service;
    }

    @GetMapping("/{slug}")
    public ApiResponse<RestaurantInfo> info(@PathVariable String slug) {
        return ApiResponse.ok("Restaurant info fetched", service.publicRestaurant(slug));
    }

    @GetMapping("/{slug}/menu")
    public ApiResponse<FullMenu> menu(@PathVariable String slug) {
        return ApiResponse.ok("Menu fetched", service.publicMenu(slug));
    }
}
