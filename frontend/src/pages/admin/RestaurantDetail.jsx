import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CurrencyRupeeIcon from '@mui/icons-material/CurrencyRupee';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import ReceiptIcon from '@mui/icons-material/Receipt';
import StarOutlineIcon from '@mui/icons-material/StarBorder';
import WalletIcon from '@mui/icons-material/AccountBalanceWallet';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import EmptyState from '../../components/EmptyState.jsx';
import StatCard from '../../components/StatCard.jsx';
import { getDashboard, getRestaurantSummaries, getRevenue, getTopItems } from '../../services/analytics.js';
import { searchOrders } from '../../services/kitchen.js';
import { createBranch, getRestaurant, listBranches, updateRestaurant } from '../../services/restaurant.js';
import { listStaff } from '../../services/staff.js';

const EMPTY_BRANCH = { name: '', address: '', phone: '', openingTime: '', closingTime: '' };
const STATUSES = ['ALL', 'PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'];

const inr = (n) => `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const todayKolkata = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

/** Open-now derived from HH:mm hours in Asia/Kolkata. Null when hours unset. */
function openNow(branch) {
  if (!branch?.openingTime || !branch?.closingTime) return null;
  try {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const mins = now.getHours() * 60 + now.getMinutes();
    const [oh, om] = branch.openingTime.split(':').map(Number);
    const [ch, cm] = branch.closingTime.split(':').map(Number);
    const open = oh * 60 + om;
    const close = ch * 60 + cm;
    if (close <= open) return mins >= open || mins < close; // overnight
    return mins >= open && mins < close;
  } catch {
    return null;
  }
}

export default function RestaurantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [rest, setRest] = useState(null);
  const [branches, setBranches] = useState([]);
  const [branchFilter, setBranchFilter] = useState('');
  const [error, setError] = useState(null);

  // Settings (existing behaviour, moved under tab)
  const [edit, setEdit] = useState({ description: '', taxPercentage: '' });
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_BRANCH);
  const [formError, setFormError] = useState(null);

  // Overview data
  const [summary, setSummary] = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [liveOrders, setLiveOrders] = useState([]);
  const [dueTotal, setDueTotal] = useState(0);
  const [loadingOv, setLoadingOv] = useState(true);

  // Orders tab
  const [history, setHistory] = useState([]);
  const [historyDate, setHistoryDate] = useState(todayKolkata());
  const [historyStatus, setHistoryStatus] = useState('ALL');
  const [historyLoading, setHistoryLoading] = useState(false);

  // Staff tab
  const [staff, setStaff] = useState(null);

  /** Scope for every scoped call: branch when picked, else whole restaurant. */
  const scopeKey = branchFilter || `r:${id}`;

  const loadBase = useCallback(() => {
    setError(null);
    return Promise.all([getRestaurant(id), listBranches(id)])
      .then(([r, b]) => {
        setRest(r.data);
        setBranches(b.data ?? []);
        setEdit({ description: r.data.description ?? '', taxPercentage: r.data.taxPercentage });
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const loadOverview = useCallback(() => {
    setLoadingOv(true);
    const s = { ...(branchFilter ? { branchId: branchFilter } : { restaurantId: id }) };
    return Promise.all([
      getDashboard(s.branchId, s.restaurantId),
      getRevenue({ period: 'week', ...s }),
      getTopItems({ limit: 5, ...s }),
      searchOrders({ liveOnly: true, ...s }),
      getRestaurantSummaries(),
    ])
      .then(([d, r, t, live, sums]) => {
        setSummary(d.data);
        setRevenue(r.data ?? []);
        setTopItems(t.data ?? []);
        setLiveOrders(live.data ?? []);
        const row = (sums.data ?? []).find((x) => x.restaurantId === id);
        setDueTotal(Number(row?.balanceDue ?? 0));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingOv(false));
  }, [branchFilter, id]);

  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    const s = { ...(branchFilter ? { branchId: branchFilter } : { restaurantId: id }) };
    return searchOrders({
      ...s,
      date: historyDate || undefined,
      status: historyStatus && historyStatus !== 'ALL' ? historyStatus : undefined,
    })
      .then((h) => setHistory((h.data ?? []).slice(0, 30)))
      .catch((e) => setError(e.message))
      .finally(() => setHistoryLoading(false));
  }, [branchFilter, id, historyDate, historyStatus]);

  const loadStaff = useCallback(() => {
    const params = branchFilter ? { branchId: branchFilter } : { restaurantId: id };
    return listStaff(params)
      .then((r) => setStaff(r.data ?? []))
      .catch((e) => setError(e.message));
  }, [branchFilter, id]);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (tab === 'overview') loadOverview();
    if (tab === 'orders') loadHistory();
    if (tab === 'staff') loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, scopeKey]);

  // Live orders stay fresh while the overview is open.
  useEffect(() => {
    if (tab !== 'overview') return undefined;
    const t = setInterval(() => {
      const s = { ...(branchFilter ? { branchId: branchFilter } : { restaurantId: id }) };
      searchOrders({ liveOnly: true, ...s })
        .then((r) => setLiveOrders(r.data ?? []))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, [tab, branchFilter, id]);

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSaveDetails(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateRestaurant(id, {
        description: edit.description,
        taxPercentage: Number(edit.taxPercentage) || 0,
      });
      loadBase();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onCreateBranch(e) {
    e.preventDefault();
    setFormError(null);
    try {
      await createBranch(id, {
        ...form,
        openingTime: form.openingTime || undefined,
        closingTime: form.closingTime || undefined,
      });
      setOpen(false);
      setForm(EMPTY_BRANCH);
      loadBase();
    } catch (err) {
      setFormError(err.message);
    }
  }

  const shownBranch = branches.find((b) => b.id === branchFilter) ?? branches[0] ?? null;
  const isOpen = openNow(shownBranch);
  const maxRevenue = Math.max(1, ...revenue.map((p) => Number(p.revenue ?? 0)));

  if (error && !rest) return <Alert severity="error">{error}</Alert>;
  if (!rest) return <CircularProgress />;

  return (
    <Box>
      {/* ── Zomato-style outlet header ── */}
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 4, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Box sx={{ flexGrow: 1, minWidth: 220 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
                {rest.name}
              </Typography>
              {isOpen !== null && (
                <Chip
                  size="small"
                  label={isOpen ? 'Open now' : 'Closed'}
                  color={isOpen ? 'success' : 'default'}
                />
              )}
              <Chip
                size="small"
                icon={<StarOutlineIcon />}
                label="Ratings coming soon"
                variant="outlined"
                title="Customer ratings land in a future update"
              />
            </Box>
            {rest.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {rest.description}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {[shownBranch?.address, shownBranch?.phone,
                shownBranch?.openingTime && shownBranch?.closingTime
                  ? `${shownBranch.openingTime}–${shownBranch.closingTime}` : null,
                `/${rest.slug} · ${rest.currency} · GST ${rest.taxPercentage}%`,
              ].filter(Boolean).join(' · ')}
            </Typography>
          </Box>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Branch</InputLabel>
            <Select value={branchFilter} label="Branch" onChange={(e) => setBranchFilter(e.target.value)}>
              <MenuItem value="">All branches</MenuItem>
              {branches.map((b) => (
                <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mt: 1.5 }}>
          <Tab value="overview" label="Overview" />
          <Tab value="orders" label="Orders" />
          <Tab value="menu" label="Menu" />
          <Tab value="staff" label="Staff" />
          <Tab value="settings" label="Settings" />
        </Tabs>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {tab === 'overview' && (
        <>
          {loadingOv ? (
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', lg: '1fr 1fr 1fr 1fr' } }}>
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={96} />)}
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', lg: '1fr 1fr 1fr 1fr' } }}>
                <StatCard icon={<CurrencyRupeeIcon />} label="Today's revenue" value={inr(summary?.todayRevenue)} hint={`${summary?.paymentsToday ?? 0} payment(s)`} />
                <StatCard icon={<ReceiptIcon />} label="Orders today" value={String(summary?.ordersToday ?? 0)} hint={`${inr(summary?.todayOrderValue)} order value`} />
                <StatCard icon={<HourglassTopIcon />} label="Live now" value={`${liveOrders.length} orders · ${summary?.activeTables ?? 0} tables`} hint={summary?.avgPrepMinutes != null ? `Avg prep ${summary.avgPrepMinutes} min` : 'No prep data yet'} />
                <StatCard icon={<WalletIcon />} label="Balance due" value={inr(dueTotal)} hint={dueTotal > 0 ? 'Collect before closing tables' : 'Nothing outstanding'} />
              </Box>

              <Box sx={{ display: 'grid', gap: 2, mt: 2, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' } }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Revenue this week</Typography>
                    {revenue.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">No revenue yet.</Typography>
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 160, pt: 1 }}>
                        {revenue.map((p) => (
                          <Box key={p.date} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                            <Typography variant="caption" fontWeight={700} noWrap>
                              {Number(p.revenue) > 0 ? inr(p.revenue) : ''}
                            </Typography>
                            <Box sx={{
                              width: '100%',
                              height: Math.max(6, (Number(p.revenue ?? 0) / maxRevenue) * 110),
                              borderRadius: 1.5, bgcolor: 'primary.main',
                              opacity: Number(p.revenue) > 0 ? 1 : 0.25,
                            }} />
                            <Typography variant="caption" color="text.secondary">
                              {new Date(`${p.date}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' })}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Top dishes today</Typography>
                    {topItems.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">No sales yet today.</Typography>
                    ) : (
                      <Box sx={{ display: 'grid', gap: 1 }}>
                        {topItems.map((item, i) => (
                          <Box key={item.name} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                            <Typography variant="body2" noWrap>{i + 1}. {item.name} ({item.quantity})</Typography>
                            <Typography variant="body2" fontWeight={700}>{inr(item.revenue)}</Typography>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Box>

              <Card sx={{ mt: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                      Live orders ({liveOrders.length})
                    </Typography>
                    <Button size="small" variant="outlined" onClick={() => navigate('/kitchen')}>
                      Open KDS
                    </Button>
                  </Box>
                  {liveOrders.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">No live orders right now.</Typography>
                  ) : (
                    <Box sx={{ display: 'grid', gap: 1 }}>
                      {liveOrders.slice(0, 10).map((o) => (
                        <Box key={o.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
                          <Typography variant="body2" noWrap>
                            {o.orderNumber} · T{o.tableNumber} · {o.status}
                          </Typography>
                          <Typography variant="body2" fontWeight={700}>{inr(o.totalAmount)}</Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {tab === 'orders' && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
              <Typography variant="h6" sx={{ flexGrow: 1 }}>Order history</Typography>
              <TextField size="small" type="date" label="Date" value={historyDate}
                onChange={(e) => setHistoryDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField size="small" select label="Status" value={historyStatus}
                onChange={(e) => setHistoryStatus(e.target.value)} sx={{ minWidth: 140 }}
                slotProps={{ inputLabel: { shrink: true }, select: { native: true } }}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </TextField>
            </Box>
            {historyLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
            ) : history.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No orders match these filters.</Typography>
            ) : (
              <Box sx={{ display: 'grid', gap: 1 }}>
                {history.map((o) => (
                  <Box key={o.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
                    <Typography variant="body2" noWrap>{o.orderNumber} · T{o.tableNumber} · {o.status}</Typography>
                    <Typography variant="body2" fontWeight={700}>{inr(o.totalAmount)}</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'menu' && (
        <Card>
          <CardContent sx={{ display: 'grid', gap: 1.5 }}>
            <Typography variant="h6">Menu & floor</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to={`/admin/restaurants/${id}/menu`} variant="contained">
                Manage menu
              </Button>
              <Button variant="outlined" onClick={() => navigate('/kitchen')}>
                Kitchen display
              </Button>
              <Button variant="outlined" onClick={() => navigate('/waiter')}>
                Waiter board
              </Button>
            </Box>
            {(branches ?? []).map((b) => (
              <Box key={b.id} sx={{ p: 2, borderRadius: 3, border: 1, borderColor: 'divider', display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="subtitle1" fontWeight={800}>{b.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {[b.address, b.phone].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
                <Button component={RouterLink} to={`/admin/branches/${b.id}/tables`} size="small" variant="outlined">
                  Tables & QR
                </Button>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      {tab === 'staff' && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Typography variant="h6" sx={{ flexGrow: 1 }}>
                Staff ({staff?.length ?? '…'})
              </Typography>
              <Button
                size="small"
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate(
                  `/admin/staff?restaurantId=${id}${branchFilter ? `&branchId=${branchFilter}&create=manager` : ''}`,
                )}
              >
                Add manager
              </Button>
            </Box>
            {!staff ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
            ) : staff.length === 0 ? (
              <EmptyState icon="👥" title="No staff here yet"
                body="Add a manager for this outlet — they get a login locked to this outlet only."
                actionLabel="Add manager"
                onAction={() => navigate(`/admin/staff?restaurantId=${id}${branchFilter ? `&branchId=${branchFilter}&create=manager` : ''}`)} />
            ) : (
              <Box sx={{ display: 'grid', gap: 1 }}>
                {staff.map((u) => (
                  <Box key={u.userId} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
                    <Typography variant="body2" noWrap>
                      {u.fullName} · {u.role}{u.branchName ? ` · ${u.branchName}` : ''}{!u.active ? ' · disabled' : ''}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>{u.email}</Typography>
                  </Box>
                ))}
              </Box>
            )}
            <Button size="small" sx={{ mt: 1 }} onClick={() => navigate(`/admin/staff?restaurantId=${id}`)}>
              Open full staff page →
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === 'settings' && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 2fr' } }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Details</Typography>
              <Box component="form" onSubmit={onSaveDetails} sx={{ display: 'grid', gap: 2 }}>
                <TextField label="Description" multiline rows={3} value={edit.description}
                  onChange={(e) => setEdit((s) => ({ ...s, description: e.target.value }))} />
                <TextField label="GST %" type="number" value={edit.taxPercentage}
                  onChange={(e) => setEdit((s) => ({ ...s, taxPercentage: e.target.value }))} />
                <Button type="submit" variant="outlined" disabled={saving}>
                  {saving ? 'Saving…' : 'Save details'}
                </Button>
              </Box>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                  Branches ({branches?.length ?? 0})
                </Typography>
                <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
                  Add branch
                </Button>
              </Box>
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                {(branches ?? []).map((b) => (
                  <Box key={b.id} sx={{
                    p: 2, borderRadius: 3, border: 1, borderColor: 'divider', bgcolor: 'background.default',
                    display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, alignItems: { sm: 'center' },
                  }}>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle1" fontWeight={800}>{b.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {[b.address, b.phone, b.openingTime && b.closingTime ? `${b.openingTime}–${b.closingTime}` : null]
                          .filter(Boolean).join(' · ')}
                      </Typography>
                    </Box>
                    <Button component={RouterLink} to={`/admin/branches/${b.id}/tables`} size="small" variant="outlined">
                      Tables & QR
                    </Button>
                  </Box>
                ))}
                {branches?.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No branches yet — add your first location.
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      <Box sx={{ mt: 2 }}>
        <Button component={RouterLink} to="/admin/restaurants" startIcon={<ArrowBackIcon />} variant="text">
          All restaurants
        </Button>
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add branch</DialogTitle>
        <Box component="form" onSubmit={onCreateBranch}>
          <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
            <TextField label="Branch name" required value={form.name} onChange={setF('name')} placeholder="Koramangala Branch" />
            <TextField label="Address" multiline rows={2} value={form.address} onChange={setF('address')} />
            <TextField label="Phone" value={form.phone} onChange={setF('phone')} />
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
              <TextField label="Opens (HH:mm)" value={form.openingTime} onChange={setF('openingTime')} placeholder="11:00" />
              <TextField label="Closes (HH:mm)" value={form.closingTime} onChange={setF('closingTime')} placeholder="23:00" />
            </Box>
            {formError && <Alert severity="error">{formError}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Create</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
