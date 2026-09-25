import AddIcon from '@mui/icons-material/Add';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControlLabel,
  MenuItem,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import EmptyState from '../../components/EmptyState.jsx';
import SeatCredentialsDialog from '../../components/SeatCredentialsDialog.jsx';
import TerminalLock from '../../components/TerminalLock.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { listBranches, listRestaurants } from '../../services/restaurant.js';
import { createStaff, listStaff, moveStaffBranch, resetStaffPassword, setStaffActive, setStaffTables } from '../../services/staff.js';
import { listTables } from '../../services/tables.js';
import { isOutletSeat, randomSeatPassword } from '../../utils/outletSeat.js';

const ROLE_LABEL = { OWNER: 'Owner', MANAGER: 'Manager', WAITER: 'Waiter', KITCHEN_STAFF: 'Kitchen', PLATFORM_ADMIN: 'Platform' };
const ROLE_COLOR = { OWNER: 'primary', MANAGER: 'secondary', WAITER: 'info', KITCHEN_STAFF: 'warning' };

const ROLE_CARDS = [
  { value: 'WAITER', title: 'Waiter', desc: 'Guest tables, order punch, serve flow.', icon: 'room_service', color: '#C2410C' },
  { value: 'KITCHEN_STAFF', title: 'Kitchen Staff', desc: 'KDS board, prep timers, 86 toggles.', icon: 'skillet', color: '#00632B' },
  { value: 'MANAGER', title: 'Manager', desc: 'Location scope: menu, tables, staff, revenue.', icon: 'badge', color: '#006A63' },
];

const EMPTY = { fullName: '', email: '', password: '', phone: '', role: 'WAITER', branchId: '', tableIds: [] };
const PAGE_SIZE = 8;

function Sym({ name, size = 18 }) {
  return (
    <Box component="span" className="material-symbols-outlined" sx={{ fontSize: size, display: 'inline-flex' }}>
      {name}
    </Box>
  );
}

const staffIdOf = (userId) => {
  const hex = String(userId ?? '').replace(/-/g, '').slice(0, 8).toUpperCase();
  return hex ? `TP-${hex}` : '—';
};

/**
 * Fix 2: table checklist locked to ONE branch.
 * When fixedBranchId is set, no restaurant/branch pickers are shown and only
 * that branch's tables can be picked — cross-branch assignment is impossible.
 */
function WaiterTablePicker({ value, onChange, fixedBranchId, preloadWaiterId, preloadBranchId }) {
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantId, setRestaurantId] = useState('');
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(fixedBranchId ?? preloadBranchId ?? '');
  const [tables, setTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [err, setErr] = useState(null);

  const locked = !!(fixedBranchId ?? preloadBranchId);

  useEffect(() => {
    setBranchId(fixedBranchId ?? preloadBranchId ?? '');
  }, [fixedBranchId, preloadBranchId]);

  useEffect(() => {
    if (locked) return;
    listRestaurants()
      .then((r) => {
        setRestaurants(r.data ?? []);
        if (r.data?.length === 1) setRestaurantId(r.data[0].id);
      })
      .catch((e) => setErr(e.message));
  }, [locked]);

  useEffect(() => {
    if (locked || !restaurantId) {
      if (!locked) setBranches([]);
      return;
    }
    listBranches(restaurantId)
      .then((r) => {
        setBranches(r.data ?? []);
        setBranchId(r.data?.[0]?.id ?? '');
      })
      .catch((e) => setErr(e.message));
  }, [restaurantId, locked]);

  useEffect(() => {
    if (!branchId) {
      setTables([]);
      return;
    }
    setLoadingTables(true);
    listTables(branchId)
      .then((r) => setTables((r.data ?? []).filter((t) => t.active)))
      .catch((e) => setErr(e.message))
      .finally(() => setLoadingTables(false));
  }, [branchId]);

  // Edit flow (locked): discover this waiter's tables in their own branch only.
  useEffect(() => {
    if (!preloadWaiterId || !preloadBranchId) return;
    let alive = true;
    (async () => {
      try {
        const ts = (await listTables(preloadBranchId)).data ?? [];
        if (alive) {
          onChange(ts.filter((t) => t.assignedWaiterId === preloadWaiterId && t.active).map((t) => t.id));
        }
      } catch (e) {
        if (alive) setErr(e.message);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preloadWaiterId, preloadBranchId]);

  const toggle = (id) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
        Assigned tables ({value.length}) — this branch only
      </Typography>
      {!locked && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, mb: 1 }}>
          <TextField label="Restaurant" select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)}>
            {restaurants.map((r) => (
              <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
            ))}
          </TextField>
          <TextField label="Location" select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.map((b) => (
              <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
            ))}
          </TextField>
        </Box>
      )}
      {err && <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert>}
      {!branchId ? (
        <Typography variant="body2" color="text.secondary">
          Pick a restaurant → location first — tables appear here.
        </Typography>
      ) : loadingTables ? (
        <CircularProgress size={20} />
      ) : tables.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No tables in this branch yet — add them under Restaurants → Tables first.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxHeight: 180, overflowY: 'auto' }}>
          {tables.map((t) => (
            <Box
              key={t.id}
              onClick={() => toggle(t.id)}
              sx={{
                display: 'flex', gap: 1, alignItems: 'center',
                border: 1, borderColor: value.includes(t.id) ? '#9B2F00' : 'divider',
                bgcolor: value.includes(t.id) ? 'rgba(194,65,12,.06)' : 'transparent',
                borderRadius: 2, px: 1.25, py: 0.75, cursor: 'pointer',
              }}
            >
              <Checkbox size="small" checked={value.includes(t.id)} tabIndex={-1} disableRipple sx={{ p: 0 }} />
              <Typography variant="body2" fontWeight={700}>
                {t.tableNumber}
                {t.assignedWaiterId && t.assignedWaiterId !== preloadWaiterId && (
                  <Typography component="span" variant="caption" color="warning.main">
                    {' '}· {t.assignedWaiterName} (moves over)
                  </Typography>
                )}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

function BranchPicker({ restaurantId, setRestaurantId, branchId, setBranchId, restaurants, branches, label }) {
  const hideRestaurant = (restaurants ?? []).length <= 1;
  const hideBranch = (branches ?? []).length <= 1;
  // Single choice on both axes: everything is auto-picked, no picker at all.
  if (hideRestaurant && hideBranch) return null;
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: hideRestaurant || hideBranch ? '1fr' : '1fr 1fr' } }}>
      {!hideRestaurant && (
        <TextField label={label ?? 'Restaurant'} select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)}>
          {restaurants.map((r) => (
            <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
          ))}
        </TextField>
      )}
      {!hideBranch && (
        <TextField label="Location" select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <MenuItem value="">All locations</MenuItem>
          {branches.map((b) => (
            <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
          ))}
        </TextField>
      )}
    </Box>
  );
}

export default function Staff() {
  const { user: me } = useAuth();
  const isOwner = me?.role === 'OWNER';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState(null);
  const [allRows, setAllRows] = useState([]);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [assignUser, setAssignUser] = useState(null);
  const [assignIds, setAssignIds] = useState([]);
  const [assignError, setAssignError] = useState(null);
  const [assignSaving, setAssignSaving] = useState(false);
  const [restaurants, setRestaurants] = useState([]);
  const [filterRestaurantId, setFilterRestaurantId] = useState('');
  const [filterBranches, setFilterBranches] = useState([]);
  const [filterBranchId, setFilterBranchId] = useState('');
  const [createBranches, setCreateBranches] = useState([]);
  const [moveBranchId, setMoveBranchId] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // all | WAITER | KITCHEN_STAFF | MANAGER
  const [statusFilter, setStatusFilter] = useState('all'); // all | active | disabled
  const [page, setPage] = useState(0);
  // Outlet-seat handover (owner only)
  const [replaceUser, setReplaceUser] = useState(null);
  const [replacePw, setReplacePw] = useState('');
  const [replaceChecks, setReplaceChecks] = useState([false, false, false, false]);
  const [replaceBusy, setReplaceBusy] = useState(false);
  const [replaceError, setReplaceError] = useState(null);
  const [creds, setCreds] = useState(null);
  const [lockPreview, setLockPreview] = useState(false);

  const load = (fBranchId, fRestaurantId) => {
    const params = {};
    if (fBranchId) params.branchId = fBranchId;
    else if (fRestaurantId) params.restaurantId = fRestaurantId;
    return listStaff(params).then((r) => setRows(r.data)).catch((e) => setError(e.message));
  };

  useEffect(() => {
    const rId = searchParams.get('restaurantId');
    const bId = searchParams.get('branchId');
    if (rId) setFilterRestaurantId(rId);
    if (searchParams.get('create') === 'manager') {
      if (rId) setCreateRestaurantId(rId);
      setForm((f) => ({ ...f, role: 'MANAGER', branchId: bId ?? f.branchId }));
      setOpen(true);
    } else if (bId) {
      setFilterBranchId(bId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    listRestaurants()
      .then((r) => {
        setRestaurants(r.data ?? []);
        if ((r.data ?? []).length === 1) setFilterRestaurantId(r.data[0].id);
      })
      .catch((e) => setError(e.message));
    listStaff({})
      .then((r) => setAllRows(r.data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!filterRestaurantId) {
      setFilterBranches([]);
      return;
    }
    listBranches(filterRestaurantId)
      .then((r) => setFilterBranches(r.data ?? []))
      .catch((e) => setError(e.message));
  }, [filterRestaurantId]);

  useEffect(() => {
    setPage(0);
    load(filterBranchId, filterRestaurantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBranchId, filterRestaurantId]);

  const [createRestaurantId, setCreateRestaurantId] = useState('');
  useEffect(() => {
    listRestaurants()
      .then((r) => {
        if (r.data?.length === 1) setCreateRestaurantId(r.data[0].id);
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!createRestaurantId) {
      setCreateBranches([]);
      return;
    }
    listBranches(createRestaurantId)
      .then((r) => {
        setCreateBranches(r.data ?? []);
        if (r.data?.length === 1) setForm((f) => ({ ...f, branchId: r.data[0].id }));
      })
      .catch((e) => setFormError(e.message));
  }, [createRestaurantId]);

  useEffect(() => {
    if (assignUser) setMoveBranchId(assignUser.branchId ?? '');
  }, [assignUser]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function persistCreate({ andAnother }) {
    setFormError(null);
    if ((form.role === 'WAITER' || form.role === 'KITCHEN_STAFF') && !form.branchId) {
      setFormError('Pick a location for this staff member.');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (form.role === 'MANAGER' && !payload.branchId) delete payload.branchId;
      if (!payload.tableIds?.length) delete payload.tableIds;
      await createStaff(payload);
      if (andAnother) {
        setForm((f) => ({ ...EMPTY, role: f.role, branchId: f.branchId }));
      } else {
        setOpen(false);
        setForm(EMPTY);
        setCreateRestaurantId('');
      }
      load(filterBranchId, filterRestaurantId);
      listStaff({}).then((r) => setAllRows(r.data ?? [])).catch(() => {});
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onCreate(e) {
    e.preventDefault();
    await persistCreate({ andAnother: false });
  }

  async function onToggle(u) {
    try {
      await setStaffActive(u.userId, !u.active);
      load(filterBranchId, filterRestaurantId);
      listStaff({}).then((r) => setAllRows(r.data ?? [])).catch(() => {});
    } catch (err) {
      setError(err.message);
    }
  }

  async function onSaveAssign(e) {
    e.preventDefault();
    if (!assignUser) return;
    setAssignError(null);
    setAssignSaving(true);
    try {
      if (moveBranchId && moveBranchId !== (assignUser.branchId ?? '')) {
        await moveStaffBranch(assignUser.userId, moveBranchId);
      }
      await setStaffTables(assignUser.userId, assignIds);
      setAssignUser(null);
      load(filterBranchId, filterRestaurantId);
    } catch (err) {
      setAssignError(err.message);
    } finally {
      setAssignSaving(false);
    }
  }

  const needsBranch = form.role === 'WAITER' || form.role === 'KITCHEN_STAFF';

  // ---- directory derivations (all real) ----
  const activeCount = allRows.filter((u) => u.active).length;
  const waiterCount = allRows.filter((u) => u.role === 'WAITER').length;
  const kitchenCount = allRows.filter((u) => u.role === 'KITCHEN_STAFF').length;
  const managerCount = allRows.filter((u) => u.role === 'MANAGER').length;
  const disabledCount = allRows.filter((u) => !u.active).length;

  const filtered = (rows ?? []).filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (statusFilter === 'active' && !u.active) return false;
    if (statusFilter === 'disabled' && u.active) return false;
    const q = query.trim().toLowerCase();
    if (q && !`${u.fullName ?? ''} ${u.email ?? ''} ${u.phone ?? ''} ${u.role ?? ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const exportCsv = () => {
    const head = ['name', 'email', 'phone', 'role', 'restaurant', 'branch', 'active'];
    const lines = (rows ?? []).map((u) =>
      [u.fullName, u.email, u.phone ?? '', u.role, u.restaurantName ?? '', u.branchName ?? '', u.active ? 'yes' : 'no']
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(','),
    );
    const url = URL.createObjectURL(new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tablepulse-roster.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const createBranchName = createBranches.find((b) => b.id === form.branchId)?.name ?? '';
  const createRestName = restaurants.find((r) => r.id === createRestaurantId)?.name ?? '';

  return (
    <Box sx={{ pb: { xs: '64px', md: 0 } }}>
      {/* breadcrumb + actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        <Box>
          <Typography variant="body2" fontSize={12} color="text.secondary">
            Admin <strong style={{ color: '#9B2F00' }}>› Operations › Staff Directory</strong>
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5, flexWrap: 'wrap' }}>
            <Typography variant="h4" fontWeight={800} fontSize={28}>
              Staff & Floor Team Management
            </Typography>
            <Chip
              size="small"
              icon={<Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#00632B', ml: 1 }} />}
              label="Live Roster Active"
              sx={{ bgcolor: 'rgba(17,126,59,.1)', color: '#00632B', fontWeight: 800, fontSize: 10 }}
            />
          </Box>
          <Typography variant="body2" fontSize={14} color="text.secondary" sx={{ mt: 0.5 }}>
            Floor roster, role permissions and manager-seat handovers across your restaurants.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignSelf: { md: 'flex-end' } }}>
          {isOwner && (
            <Button variant="outlined" startIcon={<Sym name="lock_clock" size={18} />} onClick={() => setLockPreview(true)} sx={{ borderRadius: 2, fontWeight: 700 }}>
              Lockscreen Preview
            </Button>
          )}
          <Button variant="outlined" startIcon={<Sym name="file_download" size={18} />} onClick={exportCsv} sx={{ borderRadius: 2, fontWeight: 700 }}>
            Export Roster (CSV)
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)} sx={{ borderRadius: 2, fontWeight: 800, backgroundImage: 'linear-gradient(90deg, #C2410C, #9B2F00)' }}>
            + Add Staff Member
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* KPIs (all real) */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', xl: 'repeat(4, 1fr)' }, mb: 2 }}>
        {[
          ['Active on Floor Now', `${activeCount} Staff`, `${waiterCount} waiters · ${kitchenCount} kitchen · ${managerCount} managers`, 'groups', '#00632B'],
          ['Manager Seats', `${managerCount} Managers`, allRows.filter((u) => u.role === 'MANAGER' && u.branchId).length + ' location-pinned', 'badge', '#9B2F00'],
          ['Awaiting Location', `${allRows.filter((u) => (u.role === 'WAITER' || u.role === 'KITCHEN_STAFF') && !u.branchId).length} Staff`, 'Assign from the roster below', 'person_add', '#B45309'],
          ['Disabled Logins', `${disabledCount} Staff`, 'Enable anytime from a row', 'block', '#59413A'],
        ].map(([label, value, sub, icon, color]) => (
          <Card key={label} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant="caption" fontWeight={800} fontSize={10} color="text.secondary" sx={{ textTransform: 'uppercase', display: 'block' }}>
                {label}
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                <Typography variant="h4" fontWeight={800} fontSize={28}>{value}</Typography>
                <Avatar sx={{ bgcolor: '#FAF2EE', color, borderRadius: 2, width: 40, height: 40 }}>
                  <Sym name={icon} size={20} />
                </Avatar>
              </Box>
              <Typography variant="caption" fontSize={10} color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {sub}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* filter bar */}
      <Card sx={{ borderRadius: 2, mb: 2 }}>
        <CardContent sx={{ p: 2, display: 'grid', gap: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search staff by name, phone, or role..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              sx={{ flexGrow: 1, minWidth: 220, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FAF2EE' } }}
              InputProps={{ startAdornment: <Sym name="search" size={18} /> }}
            />
            {restaurants.length > 0 && (
              <Box sx={{ minWidth: 280, flexGrow: 1 }}>
                <BranchPicker
                  restaurantId={filterRestaurantId}
                  setRestaurantId={(v) => { setFilterRestaurantId(v); setFilterBranchId(''); }}
                  branchId={filterBranchId}
                  setBranchId={setFilterBranchId}
                  restaurants={restaurants}
                  branches={filterBranches}
                  label="Filter: restaurant"
                />
              </Box>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="caption" fontWeight={800} fontSize={10} color="text.secondary">ROLE:</Typography>
              {[
                ['all', `All (${(rows ?? []).length})`],
                ['WAITER', `Waiters (${(rows ?? []).filter((u) => u.role === 'WAITER').length})`],
                ['KITCHEN_STAFF', `Kitchen (${(rows ?? []).filter((u) => u.role === 'KITCHEN_STAFF').length})`],
                ['MANAGER', `Managers (${(rows ?? []).filter((u) => u.role === 'MANAGER').length})`],
              ].map(([v, l]) => (
                <Chip
                  key={v}
                  clickable
                  onClick={() => { setRoleFilter(v); setPage(0); }}
                  label={l}
                  sx={roleFilter === v
                    ? { bgcolor: '#C2410C', color: '#fff', fontWeight: 800, fontSize: 10 }
                    : { bgcolor: '#F4ECE8', fontWeight: 600, fontSize: 10 }}
                />
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="caption" fontWeight={800} fontSize={10} color="text.secondary">STATUS:</Typography>
              {[
                ['all', 'All'],
                ['active', `Active (${(rows ?? []).filter((u) => u.active).length})`],
                ['disabled', `Disabled (${(rows ?? []).filter((u) => !u.active).length})`],
              ].map(([v, l]) => (
                <Chip
                  key={v}
                  clickable
                  onClick={() => { setStatusFilter(v); setPage(0); }}
                  label={l}
                  sx={statusFilter === v
                    ? { bgcolor: '#00632B', color: '#fff', fontWeight: 800, fontSize: 10 }
                    : { bgcolor: '#F4ECE8', fontWeight: 600, fontSize: 10 }}
                />
              ))}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* roster table (scrolls on phone) */}
      {rows === null ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="👥"
          title={query || roleFilter !== 'all' || statusFilter !== 'all' ? 'No staff match these filters' : 'No staff here yet'}
          body="Add kitchen, waiter or manager logins — workers from your other restaurants are never shown here."
          actionLabel="Add staff"
          onAction={() => setOpen(true)}
        />
      ) : (
        <Card sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ display: 'table', width: '100%', minWidth: 880 }}>
              <Box sx={{ display: 'table-row', bgcolor: '#FAF2EE', fontSize: 10, fontWeight: 800, color: 'text.secondary' }}>
                {['Staff Member', 'Role & Badge', 'Section Allocation', 'Shift Status', "Today's Pulse", 'Actions'].map((h, i) => (
                  <Box key={h} sx={{ display: 'table-cell', px: 2, py: 1.5, textTransform: 'uppercase', letterSpacing: '.06em', textAlign: i >= 4 ? 'right' : 'left' }}>
                    {h}
                  </Box>
                ))}
              </Box>
              {pageRows.map((u) => (
                <Box key={u.userId} sx={{ display: 'table-row', borderTop: 1, borderColor: 'divider', opacity: u.active ? 1 : 0.7, '&:hover': { bgcolor: '#FAF2EE' } }}>
                  <Box sx={{ display: 'table-cell', px: 2, py: 1.5 }}>
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                      <Avatar sx={{ bgcolor: '#C2410C', fontWeight: 800, width: 44, height: 44, borderRadius: 2 }}>
                        {u.fullName?.[0]?.toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body1" fontWeight={800} fontSize={16} noWrap>
                          {u.fullName}
                        </Typography>
                        <Typography variant="caption" fontSize={10} color="text.secondary" noWrap sx={{ display: 'block' }}>
                          <strong style={{ color: '#9B2F00' }}>{staffIdOf(u.userId)}</strong> · {u.phone ?? u.email}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'table-cell', px: 2, py: 1.5 }}>
                    <Chip size="small" label={ROLE_LABEL[u.role] ?? u.role} color={ROLE_COLOR[u.role] ?? 'default'} sx={{ fontWeight: 800, fontSize: 10 }} />
                    <Typography variant="caption" fontSize={10} color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {isOutletSeat(u) ? 'Manager seat login' : u.role === 'MANAGER' && !u.branchId ? 'All locations' : 'Floor login'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'table-cell', px: 2, py: 1.5 }}>
                    <Typography variant="body2" fontWeight={700} fontSize={12} noWrap>
                      {u.branchName ? `${u.restaurantName ?? ''} · ${u.branchName}` : (u.role === 'MANAGER' ? 'All locations' : 'Unassigned')}
                    </Typography>
                    {u.role === 'WAITER' && (
                      <Button size="small" variant="text" sx={{ p: 0, minWidth: 0, fontSize: 12 }} onClick={() => { setAssignIds([]); setAssignError(null); setAssignUser(u); }}>
                        Manage tables →
                      </Button>
                    )}
                  </Box>
                  <Box sx={{ display: 'table-cell', px: 2, py: 1.5 }}>
                    <Chip
                      size="small"
                      icon={<Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: u.active ? '#00632B' : '#8D7168', ml: 1 }} />}
                      label={u.active ? 'Active' : 'Disabled'}
                      sx={{ bgcolor: u.active ? 'rgba(17,126,59,.1)' : '#EEE7E3', color: u.active ? '#00632B' : 'text.secondary', fontWeight: 800, fontSize: 10 }}
                    />
                  </Box>
                  <Box sx={{ display: 'table-cell', px: 2, py: 1.5, textAlign: 'right' }}>
                    <Typography variant="body2" fontWeight={700} fontSize={12} noWrap>
                      {u.email}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'table-cell', px: 2, py: 1.5, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {(u.role === 'WAITER' || u.role === 'KITCHEN_STAFF' || u.role === 'MANAGER') && (
                      <Button size="small" variant="text" color={u.active ? 'error' : 'primary'} onClick={() => onToggle(u)}>
                        {u.active ? 'Disable' : 'Enable'}
                      </Button>
                    )}
                    {isOwner && isOutletSeat(u) && (
                      <Button
                        size="small"
                        variant="contained"
                        color="warning"
                        onClick={() => {
                          setReplaceUser(u);
                          setReplacePw(randomSeatPassword());
                          setReplaceChecks([false, false, false, false]);
                          setReplaceError(null);
                        }}
                      >
                        Replace
                      </Button>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, p: 2, bgcolor: '#FAF2EE', fontSize: 12 }}>
            <Typography variant="body2" fontSize={12} color="text.secondary">
              Showing <strong>{pageRows.length} of {filtered.length}</strong> · <strong style={{ color: '#00632B' }}>{activeCount} active now</strong>
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Button size="small" disabled={safePage === 0} onClick={() => setPage((p) => p - 1)}>
                ‹ Prev
              </Button>
              {Array.from({ length: pageCount }).slice(0, 5).map((_, i) => (
                <Button
                  key={i}
                  size="small"
                  variant={i === safePage ? 'contained' : 'text'}
                  onClick={() => setPage(i)}
                  sx={{ minWidth: 32, borderRadius: 2 }}
                >
                  {i + 1}
                </Button>
              ))}
              <Button size="small" disabled={safePage >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
                Next ›
              </Button>
            </Box>
          </Box>
        </Card>
      )}

      {/* add drawer */}
      <Drawer
        anchor={isMobile ? 'bottom' : 'right'}
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: isMobile
            ? { height: '92vh', borderTopLeftRadius: 28, borderTopRightRadius: 28 }
            : { width: 620, maxWidth: '100vw' },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ p: { xs: 2.5, sm: 3 }, pb: 2, bgcolor: '#FAF2EE', flexShrink: 0 }}>
            {isMobile && <Box sx={{ width: 48, height: 6, borderRadius: 999, bgcolor: '#E1BFB5', mx: 'auto', mb: 1.5 }} />}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
              <Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Typography variant="h5" fontWeight={800} fontSize={22}>Add New Staff Member</Typography>
                  <Chip size="small" label="Onboarding" sx={{ bgcolor: '#FFDBD0', color: '#9B2F00', fontWeight: 800, fontSize: 10 }} />
                </Box>
                <Typography variant="body2" fontSize={12} color="text.secondary">
                  Provision floor credentials and access roles.
                </Typography>
              </Box>
              <Button size="small" onClick={() => setOpen(false)} sx={{ minWidth: 0 }}>
                <Sym name="close" size={20} />
              </Button>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1.5, p: 1.25, borderRadius: 2, bgcolor: '#fff', flexWrap: 'wrap' }}>
              <Sym name="storefront" size={18} />
              <Typography variant="body2" fontWeight={800} fontSize={14}>
                Restaurant: {createRestName || '—'} · {createBranchName || 'pick a location below'}
              </Typography>
              <Chip size="small" icon={<Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#00632B', ml: 1 }} />} label="Live POS Sync Ready" sx={{ bgcolor: 'rgba(17,126,59,.1)', color: '#00632B', fontWeight: 800, fontSize: 10 }} />
            </Box>
          </Box>

          <Box component="form" onSubmit={onCreate} sx={{ flexGrow: 1, overflowY: 'auto', p: { xs: 2.5, sm: 3 }, display: 'grid', gap: 2.5, alignContent: 'start' }}>
            <Box>
              <Typography variant="body1" fontWeight={800} fontSize={16} sx={{ mb: 1.5 }}>
                <Avatar sx={{ bgcolor: '#C2410C', color: '#fff', width: 24, height: 24, fontSize: 12, fontWeight: 800, display: 'inline-flex', mr: 1, verticalAlign: 'middle' }}>1</Avatar>
                Personal & Contact Information
              </Typography>
              <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                <TextField label="Full name *" required value={form.fullName} onChange={set('fullName')} placeholder="Ravi Kumar" sx={{ gridColumn: { xs: 'span 1', sm: 'span 2' }, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FAF2EE', height: 48 } }} />
                <TextField label="Email (login) *" required type="email" value={form.email} onChange={set('email')} placeholder="ravi@cafezen.in" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FAF2EE', height: 48 } }} />
                <TextField label="Phone" value={form.phone} onChange={set('phone')} placeholder="+91…" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FAF2EE', height: 48 } }} />
                <TextField label="Password (min 8) *" required type="password" value={form.password} onChange={set('password')} slotProps={{ htmlInput: { minLength: 8 } }} sx={{ gridColumn: { xs: 'span 1', sm: 'span 2' }, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FAF2EE', height: 48 } }} />
              </Box>
            </Box>

            <Box>
              <Typography variant="body1" fontWeight={800} fontSize={16} sx={{ mb: 1.5 }}>
                <Avatar sx={{ bgcolor: '#C2410C', color: '#fff', width: 24, height: 24, fontSize: 12, fontWeight: 800, display: 'inline-flex', mr: 1, verticalAlign: 'middle' }}>2</Avatar>
                Role & Permission Tier
              </Typography>
              <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' } }}>
                {ROLE_CARDS.map((rc) => (
                  <Box
                    key={rc.value}
                    onClick={() => setForm((f) => ({ ...f, role: rc.value }))}
                    sx={{
                      p: 1.75,
                      borderRadius: 2,
                      cursor: 'pointer',
                      bgcolor: form.role === rc.value ? 'rgba(194,65,12,.06)' : '#FAF2EE',
                      border: 2,
                      borderColor: form.role === rc.value ? '#9B2F00' : 'transparent',
                      boxShadow: form.role === rc.value ? 1 : 0,
                    }}
                  >
                    <Avatar sx={{ bgcolor: '#fff', color: rc.color, borderRadius: 2, width: 40, height: 40, mb: 1 }}>
                      <Sym name={rc.icon} size={22} />
                    </Avatar>
                    <Typography variant="body2" fontWeight={800} fontSize={14}>{rc.title}</Typography>
                    <Typography variant="caption" fontSize={10} color="text.secondary">{rc.desc}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            <Box>
              <Typography variant="body1" fontWeight={800} fontSize={16} sx={{ mb: 1.5 }}>
                <Avatar sx={{ bgcolor: '#C2410C', color: '#fff', width: 24, height: 24, fontSize: 12, fontWeight: 800, display: 'inline-flex', mr: 1, verticalAlign: 'middle' }}>3</Avatar>
                Restaurant & Location Assignment
              </Typography>
              <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: (restaurants ?? []).length > 1 && createBranches.length > 1 ? '1fr 1fr' : '1fr' } }}>
                {(restaurants ?? []).length > 1 && (
                  <TextField label="Restaurant" select value={createRestaurantId} onChange={(e) => { setCreateRestaurantId(e.target.value); setForm((f) => ({ ...f, branchId: '' })); }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FAF2EE', height: 48 } }}>
                    {(restaurants ?? []).map((r) => (
                      <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
                    ))}
                  </TextField>
                )}
                {createBranches.length > 1 && (
                  <TextField
                    label={form.role === 'MANAGER' ? 'Location (optional = all)' : 'Location *'}
                    select
                    required={needsBranch}
                    value={form.branchId}
                    onChange={set('branchId')}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FAF2EE', height: 48 } }}
                  >
                    {form.role === 'MANAGER' && <MenuItem value="">All locations</MenuItem>}
                    {createBranches.map((b) => (
                      <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
                    ))}
                  </TextField>
                )}
              </Box>
              <Typography variant="caption" fontSize={10} color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                They log in at /login with this email + password. Waiters/kitchen belong to one branch only. PIN unlock arrives with Phase B terminals.
              </Typography>
              {form.role === 'WAITER' && form.branchId && (
                <Box sx={{ mt: 1.5 }}>
                  <WaiterTablePicker
                    value={form.tableIds ?? []}
                    onChange={(ids) => setForm((f) => ({ ...f, tableIds: ids }))}
                    fixedBranchId={form.branchId}
                  />
                </Box>
              )}
            </Box>

            {formError && <Alert severity="error">{formError}</Alert>}
          </Box>

          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: '#fff', display: 'flex', gap: 1, flexShrink: 0 }}>
            <Button onClick={() => setOpen(false)} sx={{ borderRadius: 2 }}>
              Cancel
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button variant="outlined" disabled={saving} onClick={() => persistCreate({ andAnother: true })} sx={{ borderRadius: 2, fontWeight: 700 }}>
              Save & Add Another
            </Button>
            <Button variant="contained" disabled={saving} onClick={() => persistCreate({ andAnother: false })} sx={{ borderRadius: 2, fontWeight: 800, backgroundImage: 'linear-gradient(90deg, #C2410C, #9B2F00)' }}>
              {saving ? 'Saving…' : 'Save & Provision Access'}
            </Button>
          </Box>
        </Box>
      </Drawer>

      <Dialog open={!!assignUser} onClose={() => setAssignUser(null)} fullWidth maxWidth="sm">
        <DialogTitle>Tables — {assignUser?.fullName}</DialogTitle>
        <Box component="form" onSubmit={onSaveAssign}>
          <DialogContent sx={{ display: 'grid', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {assignUser?.restaurantName} · {assignUser?.branchName} — tables stay inside this branch.
            </Typography>
            {assignUser && (
              <WaiterTablePicker
                value={assignIds}
                onChange={setAssignIds}
                preloadWaiterId={assignUser.userId}
                preloadBranchId={assignUser.branchId}
              />
            )}
            {assignError && <Alert severity="error" sx={{ mt: 1 }}>{assignError}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAssignUser(null)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={assignSaving}>
              {assignSaving ? 'Saving…' : 'Save tables'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={!!replaceUser} onClose={() => setReplaceUser(null)} fullWidth maxWidth="sm">
        <DialogTitle>Replace manager — {replaceUser?.branchName ?? replaceUser?.fullName}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Generates a new manager password and kills the old one everywhere at once.
            The location&apos;s menu, tables, orders and history stay exactly where they are.
          </Typography>
          <TextField
            label="New manager password (min 8)"
            value={replacePw}
            onChange={(e) => setReplacePw(e.target.value)}
            slotProps={{ htmlInput: { minLength: 8 } }}
          />
          <Button size="small" variant="outlined" sx={{ justifySelf: 'start' }} onClick={() => setReplacePw(randomSeatPassword())}>
            Regenerate strong password
          </Button>
          {[
            'Outstanding dues on this location are collected or noted',
            'No live orders are running on this location right now',
            'Table QR codes stay valid — no reprint needed',
            'New credentials will be handed to the incoming manager',
          ].map((label, i) => (
            <FormControlLabel
              key={label}
              control={
                <Checkbox
                  checked={replaceChecks[i]}
                  onChange={() => setReplaceChecks((c) => c.map((v, j) => (j === i ? !v : v)))}
                />
              }
              label={<Typography variant="body2">{label}</Typography>}
            />
          ))}
          {replaceError && <Alert severity="error">{replaceError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReplaceUser(null)}>Cancel</Button>
          <Button
            color="warning"
            variant="contained"
            disabled={replaceBusy || replacePw.trim().length < 8 || replaceChecks.some((c) => !c)}
            onClick={async () => {
              setReplaceBusy(true);
              setReplaceError(null);
              try {
                await resetStaffPassword(replaceUser.userId, replacePw.trim());
                setCreds({
                  email: replaceUser.email,
                  password: replacePw.trim(),
                  outletName: replaceUser.branchName ?? replaceUser.fullName,
                });
                setReplaceUser(null);
                load(filterBranchId, filterRestaurantId);
              } catch (err) {
                setReplaceError(err.message);
              } finally {
                setReplaceBusy(false);
              }
            }}
          >
            {replaceBusy ? 'Replacing…' : 'Reset & show once'}
          </Button>
        </DialogActions>
      </Dialog>

      <SeatCredentialsDialog
        key={creds?.email ?? 'closed'}
        open={!!creds}
        email={creds?.email}
        password={creds?.password}
        outletName={creds?.outletName}
        onDone={() => setCreds(null)}
      />

      <TerminalLock
        open={lockPreview}
        onClose={() => setLockPreview(false)}
        outletName={filterBranches.find((b) => b.id === filterBranchId)?.name ?? restaurants.find((r) => r.id === filterRestaurantId)?.name ?? 'Restaurant'}
        branchName={filterBranches.find((b) => b.id === filterBranchId)?.name ?? ''}
        staffCount={(rows ?? []).length}
      />
    </Box>
  );
}
