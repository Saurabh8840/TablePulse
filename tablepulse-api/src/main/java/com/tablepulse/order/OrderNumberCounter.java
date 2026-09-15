package com.tablepulse.order;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import com.tablepulse.restaurant.Branch;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "order_number_counters")
@IdClass(OrderNumberCounter.CounterId.class)
@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrderNumberCounter {

    @Id
    @ManyToOne
    @JoinColumn(name = "branch_id", nullable = false)
    private Branch branch;

    @Id
    @Column(name = "day", nullable = false)
    private LocalDate day;

    @Column(name = "last_number", nullable = false)
    private int lastNumber;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CounterId implements Serializable {
        private UUID branch;
        private LocalDate day;
    }
}
