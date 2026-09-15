package com.tablepulse.table;

import com.tablepulse.auth.UserRepository;
import com.tablepulse.common.security.RoleGuard;
import com.tablepulse.common.security.TenantGuard;
import com.tablepulse.order.TableSession;
import com.tablepulse.order.TableSessionRepository;
import com.tablepulse.restaurant.Branch;
import com.tablepulse.restaurant.Restaurant;
import com.tablepulse.table.dto.BulkDeleteTablesRequest;
import com.tablepulse.table.dto.BulkDeleteTablesResponse;
import com.tablepulse.table.dto.CreateTableRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for table delete guards + number reuse (V8).
 * No DB — all repositories/guards mocked.
 */
@ExtendWith(MockitoExtension.class)
class TableServiceTest {

    @Mock
    private RestaurantTableRepository tables;
    @Mock
    private TenantGuard guard;
    @Mock
    private RoleGuard roles;
    @Mock
    private UserRepository users;
    @Mock
    private TableSessionRepository sessions;
    @Mock
    private QrCodeService qrCodes;

    private TableService service;
    private Branch branch;
    private UUID branchId;

    @BeforeEach
    void setUp() {
        service = new TableService(tables, guard, roles, users, sessions, qrCodes,
                "https://tablepulse.in");
        branchId = UUID.randomUUID();
        Restaurant restaurant = Restaurant.builder()
                .id(UUID.randomUUID())
                .name("Cafe Zen")
                .slug("cafe-zen")
                .build();
        branch = Branch.builder()
                .id(branchId)
                .restaurant(restaurant)
                .name("Koramangala")
                .build();
    }

    private RestaurantTable table(String number, boolean active) {
        return RestaurantTable.builder()
                .id(UUID.randomUUID())
                .branch(branch)
                .tableNumber(number)
                .seatingCapacity(4)
                .status("AVAILABLE")
                .active(active)
                .build();
    }

    @Test
    void deactivateOccupiedTableIsBlocked() {
        RestaurantTable t = table("T7", true);
        doNothing().when(roles).requireOwnerOrManager();
        when(guard.table(t.getId())).thenReturn(t);
        when(sessions.findByTableIdAndStatus(t.getId(), "ACTIVE"))
                .thenReturn(List.of(TableSession.builder().id(UUID.randomUUID()).build()));

        assertThatThrownBy(() -> service.deactivateTable(t.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("occupied");
    }

    @Test
    void deactivateFreeTableSucceeds() {
        RestaurantTable t = table("T8", true);
        doNothing().when(roles).requireOwnerOrManager();
        when(guard.table(t.getId())).thenReturn(t);
        when(sessions.findByTableIdAndStatus(t.getId(), "ACTIVE")).thenReturn(List.of());
        when(tables.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.deactivateTable(t.getId());

        assertThat(t.isActive()).isFalse();
        verify(tables).save(t);
    }

    @Test
    void createReusesNumberOfInactiveTable() {
        doNothing().when(roles).requireOwnerOrManager();
        when(guard.branch(branchId)).thenReturn(branch);
        when(tables.existsByBranchIdAndTableNumberAndActiveTrue(branchId, "T7")).thenReturn(false);
        when(tables.save(any())).thenAnswer(inv -> {
            RestaurantTable t = inv.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            return t;
        });

        CreateTableRequest req = new CreateTableRequest();
        req.setTableNumber("T7");
        req.setSeatingCapacity(4);

        assertThat(service.createTable(branchId, req).getTableNumber()).isEqualTo("T7");
    }

    @Test
    void createConflictsOnActiveNumber() {
        doNothing().when(roles).requireOwnerOrManager();
        when(guard.branch(branchId)).thenReturn(branch);
        when(tables.existsByBranchIdAndTableNumberAndActiveTrue(branchId, "T7")).thenReturn(true);

        CreateTableRequest req = new CreateTableRequest();
        req.setTableNumber("T7");
        req.setSeatingCapacity(4);

        assertThatThrownBy(() -> service.createTable(branchId, req))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void bulkDeleteIsPartialSuccess() {
        RestaurantTable free = table("T1", true);
        RestaurantTable occupied = table("T2", true);
        doNothing().when(roles).requireOwnerOrManager();
        when(guard.branch(branchId)).thenReturn(branch);
        when(guard.table(free.getId())).thenReturn(free);
        when(guard.table(occupied.getId())).thenReturn(occupied);
        when(sessions.findByTableIdAndStatus(free.getId(), "ACTIVE")).thenReturn(List.of());
        when(sessions.findByTableIdAndStatus(occupied.getId(), "ACTIVE"))
                .thenReturn(List.of(TableSession.builder().id(UUID.randomUUID()).build()));
        when(tables.save(any())).thenAnswer(inv -> inv.getArgument(0));

        BulkDeleteTablesRequest req = new BulkDeleteTablesRequest();
        req.setTableIds(List.of(free.getId(), occupied.getId()));
        BulkDeleteTablesResponse res = service.bulkDelete(branchId, req);

        assertThat(res.getDeleted()).containsExactly("T1");
        assertThat(res.getBlocked()).hasSize(1);
        assertThat(res.getBlocked().get(0).getTableNumber()).isEqualTo("T2");
        assertThat(free.isActive()).isFalse();
        assertThat(occupied.isActive()).isTrue();
    }
}
