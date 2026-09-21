import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StarOutlineIcon from '@mui/icons-material/StarBorder';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
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
import { getDashboard, getRestaurantSummaries, getRevenue, getTopItems } from '../../services/analytics.js';
import { searchOrders } from '../../services/kitchen.js';
import { getPublicMenu } from '../../services/ordering.js';
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

  // Gallery: all dish photos of this outlet (Zomato-style strip + lightbox).
  const [photos, setPhotos] = useState([]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [fullPhoto, setFullPhoto] = useState(null);

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

  // Gallery follows the restaurant (dish photos need no backend beyond the menu).
  useEffect(() => {
    if (!rest?.slug) return;
    let alive = true;
    getPublicMenu(rest.slug)
      .then((res) => {
        if (!alive) return;
        const seen = new Set();
        const imgs = [];
        for (const c of res.data?.categories ?? []) {
          for (const i of c.items ?? []) {
            if (i.imageUrl && !seen.has(i.imageUrl)) {
              seen.add(i.imageUrl);
              imgs.push({ src: i.imageUrl, name: i.name });
            }
          }
        }
        setPhotos(imgs);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [rest?.slug]);

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

  if (error && !rest) return <Alert severity="error">{error}</Alert>;
  if (!rest) return <CircularProgress />;

  // Derived only after guards — rest is guaranteed non-null below.
  const shownBranch = branches.find((b) => b.id === branchFilter) ?? branches[0] ?? null;
  const isOpen = openNow(shownBranch);
  const maxRevenue = Math.max(1, ...revenue.map((p) => Number(p.revenue ?? 0)));
  const coverSrc = photos[0]?.src ?? null;
  // Descriptions often already contain the shop address — don't print it twice.
  const descLower = (rest.description ?? '').toLowerCase();
  const branchAddr = shownBranch?.address ?? '';
  const showAddr = branchAddr && !descLower.includes(branchAddr.slice(0, 28).toLowerCase());

  return (
    <Box>
      {/* ── Cover: the page opens on the restaurant, not on a card ── */}
      <Box sx={{
        position: 'relative', height: { xs: 180, md: 240 }, borderRadius: 4, overflow: 'hidden',
        bgcolor: 'action.hover', border: 1, borderColor: 'divider', mb: 2,
      }}>
        {coverSrc ? (
          <Box component="img" src={coverSrc} alt={rest.name} loading="lazy" decoding="async"
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <Box sx={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 72, fontWeight: 800, letterSpacing: '-0.02em', color: 'primary.main',
          }}>
            {(rest.name?.[0] ?? '·').toUpperCase()}
          </Box>
        )}
        <Box sx={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 55%)',
        }} />
        <FormControl
          size="small"
          sx={{
            position: 'absolute', top: 12, right: 12, minWidth: 150,
            bgcolor: 'background.paper', borderRadius: 3,
            '& .MuiOutlinedInput-root': { borderRadius: 3 },
          }}
        >
          <InputLabel>Branch</InputLabel>
          <Select value={branchFilter} label="Branch" onChange={(e) => setBranchFilter(e.target.value)}>
            <MenuItem value="">All branches</MenuItem>
            {branches.map((b) => (
              <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography
          variant="h3"
          fontWeight={800}
          sx={{
            position: 'absolute', left: 20, bottom: 14, color: '#fff',
            letterSpacing: '-0.02em', fontSize: { xs: 30, md: 40 }, lineHeight: 1.1,
            textShadow: '0 2px 12px rgba(0,0,0,0.45)',
          }}
        >
          {rest.name}
        </Typography>
      </Box>

      {/* ── Identity flow on the page background ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {isOpen !== null && (
          <Chip size="small" label={isOpen ? 'Open now' : 'Closed'} color={isOpen ? 'success' : 'default'} />
        )}
        <Chip
          size="small"
          icon={<StarOutlineIcon />}
          label="Ratings coming soon"
          variant="outlined"
          title="Customer ratings land in a future update"
        />
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="body2" color="text.secondary">
          /{rest.slug} · {rest.currency} · GST {rest.taxPercentage}%
        </Typography>
      </Box>
      {rest.description && (
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
          {rest.description}
        </Typography>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1 }}>
        {[showAddr ? branchAddr : null, shownBranch?.phone,
          shownBranch?.openingTime && shownBranch?.closingTime
            ? `${shownBranch.openingTime}–${shownBranch.closingTime}` : null,
        ].filter(Boolean).join(' · ')}
      </Typography>

      {/* ── Plain underline tabs, sticky ── */}
      <Box className="sticky-bar" sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider', mb: 2.5 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{
            minHeight: 48,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 48 },
            '& .Mui-selected': { color: 'primary.main' },
            '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0', bgcolor: 'primary.main' },
          }}
        >
          <Tab value="overview" label="Overview" />
          <Tab value="orders" label="Orders" />
          <Tab value="menu" label="Menu" />
          <Tab value="staff" label="Staff" />
          <Tab value="settings" label="Settings" />
        </Tabs>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {photos.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.25 }}>
            <Typography variant="h6" fontWeight={800} sx={{ flexGrow: 1, letterSpacing: '-0.01em' }}>
              Photos ({photos.length})
            </Typography>
            <Button size="small" variant="text" sx={{ fontWeight: 700 }} onClick={() => setGalleryOpen(true)}>
              View Gallery →
            </Button>
          </Box>
          <Box className="no-scrollbar" sx={{ display: 'flex', gap: 1.25, overflowX: 'auto', pb: 0.5 }}>
            {photos.map((p) => (
              <Box
                key={p.src}
                onClick={() => { setFullPhoto(p); setGalleryOpen(true); }}
                sx={{
                  width: 132, height: 96, flexShrink: 0, borderRadius: 2.5, overflow: 'hidden',
                  border: 1, borderColor: 'divider', cursor: 'pointer',
                  transition: 'transform .18s ease, box-shadow .18s ease',
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 },
                }}
              >
                <Box
                  component="img"
                  src={p.src}
                  alt={p.name}
                  loading="lazy"
                  decoding="async"
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {tab === 'overview' && (
        <>
          {loadingOv ? (
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', lg: '1fr 1fr 1fr 1fr' } }}>
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={96} />)}
            </Box>
          ) : (
            <>
              <Box sx={{
                display: 'grid', gap: 2,
                gridTemplateColumns: { xs: '1fr 1fr', lg: '1fr 1fr 1fr 1fr' },
                mb: 3, pb: 2.5, borderBottom: 1, borderColor: 'divider',
              }}>
                {[
                  { label: "Today's revenue", value: inr(summary?.todayRevenue), hint: `${summary?.paymentsToday ?? 0} payment(s)` },
                  { label: 'Orders today', value: String(summary?.ordersToday ?? 0), hint: `${inr(summary?.todayOrderValue)} order value` },
                  { label: 'Live now', value: `${liveOrders.length} orders · ${summary?.activeTables ?? 0} tables`, hint: summary?.avgPrepMinutes != null ? `Avg prep ${summary.avgPrepMinutes} min` : 'No prep data yet' },
                  { label: 'Balance due', value: inr(dueTotal), hint: dueTotal > 0 ? 'Collect before closing tables' : 'Nothing outstanding', alert: dueTotal > 0 },
                ].map((s) => (
                  <Box key={s.label}>
                    <Typography variant="body2" color="text.secondary" fontWeight={600}>
                      {s.label}
                    </Typography>
                    <Typography
                      variant="h4"
                      fontWeight={800}
                      color={s.alert ? 'warning.main' : 'text.primary'}
                      sx={{ letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', mt: 0.25 }}
                    >
                      {s.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {s.hint}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Box sx={{ display: 'grid', gap: 3, mt: 3, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' } }}>
                <Box>
                  <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: '-0.01em' }} gutterBottom>Revenue this week</Typography>
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
                  </Box>
                <Box>
                  <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: '-0.01em' }} gutterBottom>Top dishes today</Typography>
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
                  </Box>
              </Box>

              <Box sx={{ mt: 3, pt: 2.5, borderTop: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Typography variant="h6" fontWeight={800} sx={{ flexGrow: 1, letterSpacing: '-0.01em' }}>
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
              </Box>
            </>
          )}
        </>
      )}

      {tab === 'orders' && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
            <Typography variant="h6" fontWeight={800} sx={{ flexGrow: 1, letterSpacing: '-0.01em' }}>Order history</Typography>
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
        </Box>
      )}

      {tab === 'menu' && (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: '-0.01em' }}>Menu & floor</Typography>
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
        </Box>
      )}

      {tab === 'staff' && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Typography variant="h6" fontWeight={800} sx={{ flexGrow: 1, letterSpacing: '-0.01em' }}>
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
        </Box>
      )}

      {tab === 'settings' && (
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '1fr 2fr' } }}>
          <Box>
            <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: '-0.01em', mb: 2 }}>Details</Typography>
              <Box component="form" onSubmit={onSaveDetails} sx={{ display: 'grid', gap: 2 }}>
                <TextField label="Description" multiline rows={3} value={edit.description}
                  onChange={(e) => setEdit((s) => ({ ...s, description: e.target.value }))} />
                <TextField label="GST %" type="number" value={edit.taxPercentage}
                  onChange={(e) => setEdit((s) => ({ ...s, taxPercentage: e.target.value }))} />
              <Button type="submit" variant="outlined" disabled={saving}>
                {saving ? 'Saving…' : 'Save details'}
              </Button>
            </Box>
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight={800} sx={{ flexGrow: 1, letterSpacing: '-0.01em' }}>
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
            </Box>
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
      <Dialog open={galleryOpen} onClose={() => { setGalleryOpen(false); setFullPhoto(null); }} fullWidth maxWidth="md">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" fontWeight={800} sx={{ flexGrow: 1 }}>
            {fullPhoto ? fullPhoto.name : `Photos (${photos.length})`}
          </Typography>
          {fullPhoto && (
            <Button size="small" onClick={() => setFullPhoto(null)}>Grid</Button>
          )}
        </DialogTitle>
        <DialogContent>
          {fullPhoto ? (
            <Box
              component="img"
              src={fullPhoto.src}
              alt={fullPhoto.name}
              sx={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 2, bgcolor: 'action.hover' }}
            />
          ) : (
            <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' } }}>
              {photos.map((p) => (
                <Box
                  key={p.src}
                  onClick={() => setFullPhoto(p)}
                  sx={{
                    aspectRatio: '4 / 3', borderRadius: 2.5, overflow: 'hidden',
                    border: 1, borderColor: 'divider', cursor: 'pointer',
                    transition: 'transform .18s ease, box-shadow .18s ease',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 },
                  }}
                >
                  <Box
                    component="img"
                    src={p.src}
                    alt={p.name}
                    loading="lazy"
                    decoding="async"
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setGalleryOpen(false); setFullPhoto(null); }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
