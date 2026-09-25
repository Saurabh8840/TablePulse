package com.tablepulse.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ResetStaffPasswordRequest {

    @NotBlank(message = "New password is required")
    @Size(min = 8, max = 100, message = "Password must be 8-100 characters")
    private String newPassword;
}
