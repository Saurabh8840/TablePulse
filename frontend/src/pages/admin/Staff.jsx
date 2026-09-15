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
import EmptyState from '../../components/EmptyState.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import { listBranches, listRestaurants } from '../../services/restaurant.js';
import { createStaff, listStaff, setStaffActive, setStaffTables } from '../../services/staff.js';
import { listTables } from '../../services/tables.js';

const ROLE_LABEL = { OWNER: 'Owner', MANAGER: 'Manager', WAITER: 'Waiter', KITCHEN_STAFF: 'Kitchen', PLATFORM_ADMIN: 'Platform' };
const ROLE_COLOR = { OWNER: 'primary', MANAGER: 'secondary', WAITER: 'info', KITCHEN_STAFF: 'warning' };

const EMPTY = { fullName: '', email: '', password: '', phone: '', role: 'KITCHEN_STAFF', tableIds: [] };

/** Branch-grouped table checklist for waiter setup. `value` is the complete id set. */
function WaiterTablePicker({ value, onChange, preloadWaiterId }) {
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantId, setRestaurantId] = useState('');
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [tables, setTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    listRestaurants()
      .then((r) => {
        setRestaurants(r.data ?? []);
        if (r.data?.length === 1) setRestaurantId(r.data[0].id);
      })
      .catch((e) => setErr(e.message));
  }, []);

  useEffect(() => {
    if (!restaurantId) {
      setBranches([]);
      return;
    }
    listBranches(restaurantId)
      .then((r) => {
        setBranches(r.data ?? []);
        setBranchId(r.data?.[0]?.id ?? '');
      })
      .catch((e) => setErr(e.message));
  }, [restaurantId]);

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

  // Edit flow: discover this waiter's tables across all branches once.
  useEffect(() => {
    if (!preloadWaiterId) return;
    let alive = true;
    (async () => {
      try {
        const out = [];
        const rs = (await listRestaurants()).data ?? [];
        for (const r of rs) {
          const bs = (await listBranches(r.id)).data ?? [];
          for (const b of bs) {
            const ts = (await listTables(b.id)).data ?? [];
            ts.filter((t) => t.assignedWaiterId === preloadWaiterId && t.active)
              .forEach((t) => out.push(t.id));
          }
        }
        if (alive) onChange(out);
      } catch (e) {
        if (alive) setErr(e.message);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preloadWaiterId]);

  const toggle = (id) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
        Assigned tables ({value.length})
      </Typography>
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
      {err && <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert>}
      {loadingTables ? (
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

export default function Staff() {
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

  const load = () => listStaff().then((r) => setRows(r.data)).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onCreate(e) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await createStaff(form);
      setOpen(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onToggle(u) {
    try {
      await setStaffActive(u.userId, !u.active);
      load();
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
      await setStaffTables(assignUser.userId, assignIds);
      setAssignUser(null);
      load();
    } catch (err) {
      setAssignError(err.message);
    } finally {
      setAssignSaving(false);
    }
  }

  return (
    <Box>
      <PageHeader
        title="Staff"
        subtitle="Kitchen + waiter logins for your restaurants. They log in with email + password."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            Add staff
          </Button>
        }
      />
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {rows === null && <CircularProgress />}
      {rows !== null && rows.length === 0 && (
        <EmptyState
          icon="👥"
          title="No staff yet"
          body="Add your first kitchen or waiter login — they will appear here."
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
            <Typography variant="caption" color="text.secondary">
              They log in at /login with this email + password. Kitchen sees the KDS board; waiters get their tables below.
            </Typography>
            {form.role === 'WAITER' && (
              <WaiterTablePicker
                value={form.tableIds ?? []}
                onChange={(ids) => setForm((f) => ({ ...f, tableIds: ids }))}
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
          <DialogContent>
            {assignUser && (
              <WaiterTablePicker
                value={assignIds}
                onChange={setAssignIds}
                preloadWaiterId={assignUser.userId}
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
