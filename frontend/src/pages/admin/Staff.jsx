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
  FormControlLabel,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import EmptyState from '../../components/EmptyState.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import { listBranches, listRestaurants } from '../../services/restaurant.js';
import { createStaff, listStaff, moveStaffBranch, setStaffActive, setStaffTables } from '../../services/staff.js';
import { listTables } from '../../services/tables.js';

const ROLE_LABEL = { OWNER: 'Owner', MANAGER: 'Manager', WAITER: 'Waiter', KITCHEN_STAFF: 'Kitchen', PLATFORM_ADMIN: 'Platform' };
const ROLE_COLOR = { OWNER: 'primary', MANAGER: 'secondary', WAITER: 'info', KITCHEN_STAFF: 'warning' };

const EMPTY = { fullName: '', email: '', password: '', phone: '', role: 'WAITER', branchId: '', tableIds: [] };

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
          <TextField label="Branch" select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.map((b) => (
              <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
            ))}
          </TextField>
        </Box>
      )}
      {err && <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert>}
      {!branchId ? (
        <Typography variant="body2" color="text.secondary">
          Pick a restaurant → branch first — tables appear here.
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
            <FormControlLabel
              key={t.id}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 2, pr: 1, m: 0 }}
              control={<Checkbox size="small" checked={value.includes(t.id)} onChange={() => toggle(t.id)} />}
              label={
                <Typography variant="body2" fontWeight={700}>
                  {t.tableNumber}
                  {t.assignedWaiterId && t.assignedWaiterId !== preloadWaiterId && (
                    <Typography component="span" variant="caption" color="warning.main">
                      {' '}· {t.assignedWaiterName} (moves over)
                    </Typography>
                  )}
                </Typography>
              }
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

function BranchPicker({ restaurantId, setRestaurantId, branchId, setBranchId, restaurants, branches, label }) {
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
      <TextField label={label ?? 'Restaurant'} select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)}>
        {restaurants.map((r) => (
          <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
        ))}
      </TextField>
      <TextField label="Branch" select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
        <MenuItem value="">All branches</MenuItem>
        {branches.map((b) => (
          <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
        ))}
      </TextField>
    </Box>
  );
}

export default function Staff() {
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [assignUser, setAssignUser] = useState(null); // waiter being re-assigned
  const [assignIds, setAssignIds] = useState([]);
  const [assignError, setAssignError] = useState(null);
  const [assignSaving, setAssignSaving] = useState(false);
  // Fix 2: list filter — fresh restaurant/branch shows [] until staff added there.
  const [restaurants, setRestaurants] = useState([]);
  const [filterRestaurantId, setFilterRestaurantId] = useState('');
  const [filterBranches, setFilterBranches] = useState([]);
  const [filterBranchId, setFilterBranchId] = useState('');
  // Fix 2: create-form branch selection (required for WAITER/KITCHEN).
  const [createBranches, setCreateBranches] = useState([]);
  const [moveBranchId, setMoveBranchId] = useState('');

  const load = (fBranchId, fRestaurantId) => {
    const params = {};
    if (fBranchId) params.branchId = fBranchId;
    else if (fRestaurantId) params.restaurantId = fRestaurantId;
    return listStaff(params).then((r) => setRows(r.data)).catch((e) => setError(e.message));
  };

  // Deep-link from an outlet home (?restaurantId=&branchId=&create=manager):
  // prefilter the roster and open creation with the outlet prefilled.
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
    load(filterBranchId, filterRestaurantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBranchId, filterRestaurantId]);

  // Create-form: load branches for chosen restaurant.
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

  async function onCreate(e) {
    e.preventDefault();
    setFormError(null);
    if ((form.role === 'WAITER' || form.role === 'KITCHEN_STAFF') && !form.branchId) {
      setFormError('Pick a restaurant → branch for this staff member.');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (form.role === 'MANAGER' && !payload.branchId) delete payload.branchId;
      if (!payload.tableIds?.length) delete payload.tableIds;
      await createStaff(payload);
      setOpen(false);
      setForm(EMPTY);
      setCreateRestaurantId('');
      load(filterBranchId, filterRestaurantId);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onToggle(u) {
    try {
      await setStaffActive(u.userId, !u.active);
      load(filterBranchId, filterRestaurantId);
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

  return (
    <Box>
      <PageHeader
        title="Staff"
        subtitle="Kitchen + waiter logins per branch. A new restaurant shows no staff until you add them here."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            Add staff
          </Button>
        }
      />
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {restaurants.length > 0 && (
        <Box sx={{ mb: 2 }}>
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
      {rows === null && <CircularProgress />}
      {rows !== null && rows.length === 0 && (
        <EmptyState
          icon="👥"
          title="No staff in this branch yet"
          body="Add your first kitchen or waiter login for this restaurant → branch — workers from your other restaurants are never shown here."
          actionLabel="Add staff"
          onAction={() => setOpen(true)}
        />
      )}
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', xl: 'repeat(3, 1fr)' } }}>
        {(rows ?? []).map((u) => (
          <Card key={u.userId} sx={{ opacity: u.active ? 1 : 0.6 }}>
            <CardContent sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Avatar sx={{ bgcolor: 'primary.main', fontWeight: 800 }}>
                {u.fullName?.[0]?.toUpperCase()}
              </Avatar>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" fontWeight={800} noWrap>
                  {u.fullName}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {u.email}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75, flexWrap: 'wrap' }}>
                  <Chip size="small" label={ROLE_LABEL[u.role] ?? u.role} color={ROLE_COLOR[u.role] ?? 'default'} />
                  {u.branchName ? (
                    <Chip size="small" label={`${u.restaurantName ?? ''} · ${u.branchName}`} variant="outlined" />
                  ) : (
                    <Chip size="small" label={u.role === 'MANAGER' ? 'All branches' : 'No branch — assign one'} variant="outlined" color={u.role === 'MANAGER' ? 'default' : 'warning'} />
                  )}
                  {!u.active && <Chip size="small" label="Disabled" color="default" />}
                </Box>
              </Box>
              {(u.role === 'WAITER' || u.role === 'KITCHEN_STAFF' || u.role === 'MANAGER') && (
                <Button size="small" variant="text" color={u.active ? 'error' : 'primary'} onClick={() => onToggle(u)}>
                  {u.active ? 'Disable' : 'Enable'}
                </Button>
              )}
              {u.role === 'WAITER' && (
                <Button size="small" variant="outlined" onClick={() => { setAssignIds([]); setAssignError(null); setAssignUser(u); }}>
                  Tables
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add staff login</DialogTitle>
        <Box component="form" onSubmit={onCreate}>
          <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
            <TextField label="Full name" required value={form.fullName} onChange={set('fullName')} placeholder="Ravi Kumar" />
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <TextField label="Email (login)" required type="email" value={form.email} onChange={set('email')} placeholder="ravi@cafezen.in" />
              <TextField label="Phone" value={form.phone} onChange={set('phone')} />
            </Box>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <TextField label="Password (min 8)" required type="password" value={form.password}
                onChange={set('password')} slotProps={{ htmlInput: { minLength: 8 } }} />
              <TextField label="Role" select required value={form.role} onChange={set('role')}>
                <MenuItem value="KITCHEN_STAFF">🔥 Kitchen staff</MenuItem>
                <MenuItem value="WAITER">🧑‍🍳 Waiter</MenuItem>
                <MenuItem value="MANAGER">🧑‍💼 Manager</MenuItem>
              </TextField>
            </Box>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <TextField label="Restaurant" select value={createRestaurantId} onChange={(e) => { setCreateRestaurantId(e.target.value); setForm((f) => ({ ...f, branchId: '' })); }}>
                {(restaurants ?? []).map((r) => (
                  <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
                ))}
              </TextField>
              <TextField label={form.role === 'MANAGER' ? 'Branch (optional = all)' : 'Branch *'} select required={needsBranch} value={form.branchId} onChange={set('branchId')}>
                {form.role === 'MANAGER' && <MenuItem value="">All branches</MenuItem>}
                {createBranches.map((b) => (
                  <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
                ))}
              </TextField>
            </Box>
            <Typography variant="caption" color="text.secondary">
              They log in at /login with this email + password. Waiters/kitchen belong to one branch only — Bangalore staff never appears in Noida.
            </Typography>
            {form.role === 'WAITER' && form.branchId && (
              <WaiterTablePicker
                value={form.tableIds ?? []}
                onChange={(ids) => setForm((f) => ({ ...f, tableIds: ids }))}
                fixedBranchId={form.branchId}
              />
            )}
            {formError && <Alert severity="error">{formError}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Creating…' : 'Create login'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

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
    </Box>
  );
}
