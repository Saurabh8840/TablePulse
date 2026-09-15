package com.tablepulse.restaurant;

import com.tablepulse.common.dto.ApiResponse;
import com.tablepulse.restaurant.dto.BranchResponse;
import com.tablepulse.restaurant.dto.CreateBranchRequest;
import com.tablepulse.restaurant.dto.CreateRestaurantRequest;
import com.tablepulse.restaurant.dto.RestaurantResponse;
import com.tablepulse.restaurant.dto.UpdateBranchRequest;
import com.tablepulse.restaurant.dto.UpdateRestaurantRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class RestaurantController {

    private final RestaurantService service;

    public RestaurantController(RestaurantService service) {
        this.service = service;
    }

    @PostMapping("/restaurants")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<RestaurantResponse> create(@Valid @RequestBody CreateRestaurantRequest req) {
        return ApiResponse.ok("Restaurant created", service.createRestaurant(req));
    }

    @GetMapping("/restaurants")
    public ApiResponse<List<RestaurantResponse>> list() {
        return ApiResponse.ok("Restaurants fetched", service.listRestaurants());
    }

    @GetMapping("/restaurants/{id}")
    public ApiResponse<RestaurantResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok("Restaurant fetched", service.getRestaurant(id));
    }

    @PutMapping("/restaurants/{id}")
    public ApiResponse<RestaurantResponse> update(@PathVariable UUID id,
                                                  @Valid @RequestBody UpdateRestaurantRequest req) {
        return ApiResponse.ok("Restaurant updated", service.updateRestaurant(id, req));
    }

    @PostMapping("/restaurants/{id}/branches")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<BranchResponse> createBranch(@PathVariable UUID id,
                                                    @Valid @RequestBody CreateBranchRequest req) {
        return ApiResponse.ok("Branch created", service.createBranch(id, req));
    }

    @GetMapping("/restaurants/{id}/branches")
    public ApiResponse<List<BranchResponse>> listBranches(@PathVariable UUID id) {
        return ApiResponse.ok("Branches fetched", service.listBranches(id));
    }

    @PutMapping("/branches/{id}")
    public ApiResponse<BranchResponse> updateBranch(@PathVariable UUID id,
                                                    @Valid @RequestBody UpdateBranchRequest req) {
        return ApiResponse.ok("Branch updated", service.updateBranch(id, req));
    }
}
