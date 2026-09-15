package com.tablepulse.table;

import com.tablepulse.auth.User;
import com.tablepulse.restaurant.Branch;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
// Uniqueness is enforced in Postgres by partial index uq_tables_branch_number_active
// (branch_id, table_number) WHERE is_active (V8) so deleted numbers can be reused.
// No JPA uniqueConstraints here — JPA cannot express partial indexes.
@Table(name = "restaurant_tables")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RestaurantTable {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "branch_id", nullable = false)
    private Branch branch;

    @Column(name = "table_number", nullable = false, length = 10)
    private String tableNumber;

    @Column(name = "seating_capacity", nullable = false)
    @Builder.Default
    private int seatingCapacity = 4;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "AVAILABLE";

    @Column(name = "qr_code_url", length = 500)
    private String qrCodeUrl;

    /** Owning waiter (assigned by owner/manager). Null = house table, any waiter. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_waiter_id")
    private User assignedWaiter;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
