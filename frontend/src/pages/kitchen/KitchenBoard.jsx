import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
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
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import VegMark from '../../components/VegMark.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { buzz, getChime, setChimePref } from '../../utils/devicePrefs.js';
import { getDashboard } from '../../services/analytics.js';
import { searchOrders, updateOrderStatus } from '../../services/kitchen.js';
import { listCategories, listItems, setAvailability } from '../../services/menu.js';
import { listBranches, listRestaurants } from '../../services/restaurant.js';

const BRANCH_KEY = 'tp_kds_branch';
const POLL_MS = 7000;

const NEXT_ACTION = { PLACED: 'ACCEPTED', ACCEPTED: 'PREPARING', PREPARING: 'READY', READY: 'SERVED' };

function elapsedMin(placedAt, now = Date.now()) {
  try {
    return Math.max(0, (now - new Date(placedAt).getTime()) / 60000);
  } catch {
    return 0;
  }
}

function elapsedLabel(placedAt, now = Date.now()) {
  const m = elapsedMin(placedAt, now);
  if (m < 1) return 'just now';
  if (m === 1) return '1 min ago';
  if (m < 60) return `${Math.floor(m)} min ago`;
  return `${Math.floor(m / 60)}h ${Math.floor(m % 60)}m ago`;
}

/** Live mm:ss ticket timer. */
function clockLabel(placedAt, now = Date.now()) {
  try {
    const s = Math.max(0, Math.floor((now - new Date(placedAt).getTime()) / 1000));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}m ${ss}s`;
  } catch {
    return '—';
  }
}

function chime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.18].forEach((delay, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i === 0 ? 880 : 1174;
      gain.gain.value = 0.18;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.16);
    });
    setTimeout(() => ctx.close(), 600);
  } catch {
    // audio not available — board still works
  }
}

function Sym({ name, size = 18 }) {
  return (
    <Box component="span" className="material-symbols-outlined" sx={{ fontSize: size, display: 'inline-flex' }}>
      {name}
    </Box>
  );
}

function OrderCard({ order, vegOf, onAction, acting, onReject, now }) {
  const mins = elapsedMin(order.placedAt, now);
  const delayed = mins >= 10;
  const isNew = order.status === 'PLACED';
  const isReady = order.status === 'READY';
  const action = NEXT_ACTION[order.status];

  const headBg = delayed ? '#BA1A1A' : isNew ? '#006A63' : isReady ? '#00632B' : '#C2410C';
  const subBg = delayed ? '#FFDAD6' : isNew ? '#99EFE5' : isReady ? '#95F8A7' : '#FFDBD0';
  const subFg = delayed ? '#93000A' : isNew ? '#00201D' : isReady ? '#00210A' : '#7C2602';
  const subLabel = delayed
    ? 'DELAYED ALERT: >10 MINS'
    : isNew
      ? 'NEW ORDER INCOMING'
      : isReady
        ? 'READY TO SERVE'
        : 'IN PREPARATION';

  return (
    <Card variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', opacity: acting ? 0.6 : 1 }}>
      <Box sx={{ bgcolor: headBg, color: '#fff', px: 2, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Sym name={delayed ? 'crisis_alert' : isNew ? 'notifications_active' : 'skillet'} size={20} />
          <Typography variant="subtitle1" fontWeight={800} fontSize={18} sx={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>
            {order.orderNumber}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', bgcolor: 'rgba(255,255,255,.2)', px: 1, py: 0.5, borderRadius: 1.5 }}>
          <Sym name="timer" size={16} />
          <Typography variant="body1" fontWeight={800} fontSize={16} sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {clockLabel(order.placedAt, now)}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ bgcolor: subBg, color: subFg, px: 2, py: 0.75, display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 800, letterSpacing: '.06em' }}>
        <span>{subLabel}</span>
        <span>DINE-IN</span>
      </Box>
      <CardContent sx={{ p: 2, display: 'grid', gap: 1.25 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
          <Box>
            <Typography variant="h5" fontWeight={800} fontSize={22} sx={{ lineHeight: 1 }}>
              Table {order.tableNumber}
            </Typography>
            <Typography variant="caption" fontSize={10} color="text.secondary">
              {elapsedLabel(order.placedAt)}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" fontSize={10} color="text.secondary" sx={{ display: 'block' }}>
              Capt: <strong style={{ color: '#1E1B19' }}>{order.waiterName ?? order.servedBy ?? 'House'}</strong>
            </Typography>
            <Chip size="small" label={order.status} sx={{ fontSize: 10, fontWeight: 800, mt: 0.25 }} />
          </Box>
        </Box>
        {order.specialInstructions && (
          <Box sx={{ px: 1.25, py: 0.75, borderRadius: 2, bgcolor: 'rgba(180,83,9,.1)', borderLeft: 3, borderColor: 'warning.main' }}>
            <Typography variant="caption" fontWeight={700} fontSize={12}>
              “{order.specialInstructions}”
            </Typography>
          </Box>
        )}
        <Box sx={{ display: 'grid', gap: 0.75 }}>
          {(order.items ?? []).map((it, idx) => {
            const veg = vegOf(it.menuItemName);
            return (
              <Box key={idx} sx={{ display: 'flex', gap: 1, p: 1, borderRadius: 2, bgcolor: '#FAF2EE', alignItems: 'flex-start' }}>
                {veg !== null && <VegMark veg={veg} size={14} />}
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body1" fontWeight={800} fontSize={16}>
                    {it.quantity}x {it.menuItemName}
                  </Typography>
                  {(it.modifiers ?? []).length > 0 && (
                    <Typography variant="caption" fontSize={10} color="primary.main" fontWeight={600} sx={{ display: 'block' }}>
                      {(it.modifiers ?? []).map((m) => m.modifierName).join(', ')}
                    </Typography>
                  )}
                  {it.specialInstructions && (
                    <Typography variant="caption" fontSize={10} color="text.secondary" sx={{ display: 'block' }}>
                      {it.specialInstructions}
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
        {action && (
          <Button
            fullWidth
            variant="contained"
            disabled={acting}
            onClick={() => onAction(order, action)}
            startIcon={<Sym name={isNew ? 'check_circle' : 'done_all'} size={20} />}
            sx={{
              borderRadius: 2,
              minHeight: 52,
              fontWeight: 800,
              ...(isNew
                ? { bgcolor: '#9B2F00' }
                : isReady
                  ? { bgcolor: '#00632B' }
                  : { bgcolor: '#006A63' }),
            }}
          >
            {acting
              ? 'Updating…'
              : isNew
                ? 'ACCEPT & START PREP'
                : isReady
                  ? 'READY / DISPATCH'
                  : action === 'READY'
                    ? 'MARK READY'
                    : 'START PREP'}
          </Button>
        )}
        {isNew && (
          <Button
            fullWidth
            variant="text"
            color="error"
            disabled={acting}
            onClick={() => onReject(order)}
            startIcon={<Sym name="cancel" size={18} />}
            sx={{ borderRadius: 2, fontWeight: 700 }}
          >
            Reject / Out of Stock
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function KitchenBoard() {
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantId, setRestaurantId] = useState('');
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(() => localStorage.getItem(BRANCH_KEY) ?? '');
  const [orders, setOrders] = useState([]);
  const [avgPrep, setAvgPrep] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actingId, setActingId] = useState(null);
  const [sound, setSound] = useState(getChime);
  const [filter, setFilter] = useState('all'); // all | new | prep | ready | delayed
  const [ticketQuery, setTicketQuery] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [toast, setToast] = useState(null);
  const [rejectOrder, setRejectOrder] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [recallOpen, setRecallOpen] = useState(false);
  const [servedToday, setServedToday] = useState(null);
  const [recallLoading, setRecallLoading] = useState(false);
  // 86-board: kitchen-owned availability toggles.
  const [availOpen, setAvailOpen] = useState(false);
  const [availItems, setAvailItems] = useState(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availQuery, setAvailQuery] = useState('');
  const knownIds = useRef(new Set());
  const searchRef = useRef(null);
  const toastTimer = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  // Shared device pref (profile page reads the same key).
  const toggleSound = () => {
    setSound((s) => {
      setChimePref(!s);
      return !s;
    });
  };

  useEffect(() => {
    if (user?.branchId && branchId !== user.branchId) {
      setBranchId(user.branchId);
      localStorage.setItem(BRANCH_KEY, user.branchId);
    }
  }, [user, branchId]);

  useEffect(() => {
    listRestaurants()
      .then((r) => {
        setRestaurants(r.data ?? []);
        if (r.data?.length === 1) setRestaurantId(r.data[0].id);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!restaurantId) {
      setBranches([]);
      return;
    }
    listBranches(restaurantId)
      .then((r) => {
        setBranches(r.data ?? []);
        if (branchId && (r.data ?? []).some((b) => b.id === branchId)) return;
        if (r.data?.length > 0) {
          setBranchId(r.data[0].id);
          localStorage.setItem(BRANCH_KEY, r.data[0].id);
        }
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const load = useCallback(async () => {
    if (!branchId) {
      setLoading(false);
      return;
    }
    try {
      const [res, dash] = await Promise.all([
        searchOrders({ branchId, liveOnly: true }),
        getDashboard(branchId).catch(() => null),
      ]);
      const list = res.data ?? [];
      if (sound && knownIds.current.size > 0) {
        const fresh = list.filter((o) => o.status === 'PLACED' && !knownIds.current.has(o.id));
        if (fresh.length > 0) {
          chime();
          buzz([120, 60, 120]);
        }
      }
      knownIds.current = new Set(list.map((o) => o.id));
      setOrders(list);
      if (dash?.data?.avgPrepMinutes != null) setAvgPrep(dash.data.avgPrepMinutes);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [branchId, sound]);

  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  // Live mm:ss timers.
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Veg marks + 86 list share one silent menu load.
  const loadAvail = useCallback(async () => {
    if (!restaurantId) return;
    setAvailLoading(true);
    try {
      const cats = (await listCategories(restaurantId)).data ?? [];
      const per = await Promise.all(
        cats.filter((c) => c.active !== false).map(async (c) => {
          const items = (await listItems(c.id)).data ?? [];
          return items
            .filter((i) => i.active !== false)
            .map((i) => ({ ...i, categoryName: c.name }));
        }),
      );
      setAvailItems(per.flat());
    } catch (e) {
      setError(e.message);
    } finally {
      setAvailLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (restaurantId && availItems === null && !availLoading) loadAvail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const vegOf = useCallback(
    (name) => {
      const hit = (availItems ?? []).find((i) => i.name === name);
      return hit && typeof hit.vegetarian === 'boolean' ? hit.vegetarian : null;
    },
    [availItems],
  );

  async function handleAction(order, action) {
    setActingId(order.id);
    try {
      await updateOrderStatus(order.id, action);
      showToast(action === 'READY' ? 'Ticket dispatched to service runner!' : `Ticket moved to ${action}.`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActingId(null);
    }
  }

  async function handleReject() {
    if (!rejectOrder) return;
    setActingId(rejectOrder.id);
    try {
      await updateOrderStatus(rejectOrder.id, 'REJECTED', rejectReason.trim() || undefined);
      showToast('Ticket rejected — removed from the customer view.');
      setRejectOrder(null);
      setRejectReason('');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActingId(null);
    }
  }

  async function handleStartAll() {
    const fresh = orders.filter((o) => o.status === 'PLACED');
    if (fresh.length === 0) return;
    setActingId('bulk');
    try {
      for (const o of fresh) {
        await updateOrderStatus(o.id, 'ACCEPTED');
      }
      showToast(`${fresh.length} ticket${fresh.length === 1 ? '' : 's'} fired to stations.`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActingId(null);
    }
  }

  async function openRecall() {
    setRecallOpen(true);
    setRecallLoading(true);
    try {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const res = await searchOrders({ branchId, status: 'SERVED', date: today });
      setServedToday(res.data ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setRecallLoading(false);
    }
  }

  async function toggleAvail(item) {
    try {
      const res = await setAvailability(item.id, !item.available);
      const row = res.data ?? { ...item, available: !item.available };
      setAvailItems((list) => (list ?? []).map((i) => (i.id === item.id ? { ...i, ...row } : i)));
      showToast(`${item.name} marked ${row.available ? 'available back on menu' : 'sold out — QR ordering halted'}.`);
    } catch (e) {
      setError(e.message);
    }
  }

  // Bump bar: 1 = search, 2 = bump oldest, 3 = quick 86.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.matches('input, textarea, select')) return;
      if (e.key === '1') searchRef.current?.focus();
      else if (e.key === '2') {
        const cand = orders.filter((o) => NEXT_ACTION[o.status]);
        if (cand.length > 0) {
          cand.sort((a, b) => new Date(a.placedAt) - new Date(b.placedAt));
          handleAction(cand[0], NEXT_ACTION[cand[0].status]);
        }
      } else if (e.key === '3') setAvailOpen(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const counts = useMemo(() => {
    const c = { all: orders.length, new: 0, prep: 0, ready: 0, delayed: 0 };
    for (const o of orders) {
      if (o.status === 'PLACED') c.new += 1;
      if (o.status === 'ACCEPTED' || o.status === 'PREPARING') c.prep += 1;
      if (o.status === 'READY') c.ready += 1;
      if (['PLACED', 'ACCEPTED', 'PREPARING'].includes(o.status) && elapsedMin(o.placedAt, nowMs) >= 10) c.delayed += 1;
    }
    return c;
  }, [orders, nowMs]);

  const visible = useMemo(() => {
    const q = ticketQuery.trim().toLowerCase();
    let list = orders.filter((o) => {
      if (q && !`${o.tableNumber ?? ''} ${o.orderNumber ?? ''}`.toLowerCase().includes(q)) return false;
      if (filter === 'new') return o.status === 'PLACED';
      if (filter === 'prep') return o.status === 'ACCEPTED' || o.status === 'PREPARING';
      if (filter === 'ready') return o.status === 'READY';
      if (filter === 'delayed')
        return ['PLACED', 'ACCEPTED', 'PREPARING'].includes(o.status) && elapsedMin(o.placedAt, nowMs) >= 10;
      return true;
    });
    list = [...list].sort((a, b) => {
      const da = ['PLACED', 'ACCEPTED', 'PREPARING'].includes(a.status) && elapsedMin(a.placedAt, nowMs) >= 10;
      const db = ['PLACED', 'ACCEPTED', 'PREPARING'].includes(b.status) && elapsedMin(b.placedAt, nowMs) >= 10;
      if (da !== db) return da ? -1 : 1;
      return new Date(a.placedAt) - new Date(b.placedAt);
    });
    return list;
  }, [orders, ticketQuery, filter, nowMs]);

  const branchName = branches.find((b) => b.id === branchId)?.name ?? (user?.branchName ?? 'Kitchen');

  return (
    <Box sx={{ pb: { xs: '64px', md: 0 } }}>
      {/* control strip */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', bgcolor: '#FAF2EE', px: 2, py: 1, borderRadius: 2 }}>
              <Sym name="receipt_long" size={22} />
              <Typography variant="subtitle1" fontWeight={800} fontSize={18}>
                Active Tickets: {counts.all}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                <Chip size="small" label={`${counts.new} New`} sx={{ bgcolor: '#006A63', color: '#fff', fontWeight: 800, fontSize: 10 }} />
                <Chip size="small" label={`${counts.prep} In Prep`} sx={{ bgcolor: '#C2410C', color: '#fff', fontWeight: 800, fontSize: 10 }} />
                {counts.delayed > 0 && (
                  <Chip size="small" icon={<Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#fff', ml: 1 }} />} label={`${counts.delayed} Delayed`} sx={{ bgcolor: '#BA1A1A', color: '#fff', fontWeight: 800, fontSize: 10 }} />
                )}
              </Box>
            </Box>
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1, alignItems: 'center', bgcolor: '#FAF2EE', px: 2, py: 1, borderRadius: 2 }}>
              <Sym name="avg_time" size={20} />
              <Box>
                <Typography variant="caption" fontSize={10} color="text.secondary" sx={{ textTransform: 'uppercase', display: 'block' }}>
                  Avg Cook Velocity
                </Typography>
                <Typography variant="body1" fontWeight={800} fontSize={16}>
                  {avgPrep != null ? `${avgPrep} min` : '—'}
                </Typography>
              </Box>
            </Box>
            {user?.branchId ? (
              <Alert severity="info" sx={{ py: 0.5 }}>
                Locked to {branchName} · Contact owner to move locations.
              </Alert>
            ) : (
              <>
                {restaurants.length > 1 && (
                  <FormControl size="small" sx={{ minWidth: 170 }}>
                    <InputLabel>Restaurant</InputLabel>
                    <Select value={restaurantId} label="Restaurant" onChange={(e) => setRestaurantId(e.target.value)}>
                      {restaurants.map((r) => (
                        <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
                {branches.length > 1 && (
                  <FormControl size="small" sx={{ minWidth: 170 }}>
                    <InputLabel>Location</InputLabel>
                    <Select
                      value={branchId}
                      label="Location"
                      onChange={(e) => {
                        setBranchId(e.target.value);
                        localStorage.setItem(BRANCH_KEY, e.target.value);
                      }}
                    >
                      {branches.map((b) => (
                        <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="outlined" startIcon={<Sym name="history" size={20} />} onClick={openRecall} sx={{ borderRadius: 2, fontWeight: 700, minHeight: 48 }}>
              Recall KOT
            </Button>
            <Button variant="outlined" startIcon={sound ? <VolumeUpIcon /> : <VolumeOffIcon />} onClick={toggleSound} sx={{ borderRadius: 2, fontWeight: 700, minHeight: 48 }}>
              Ding: <strong>&nbsp;{sound ? 'ON' : 'OFF'}</strong>
            </Button>
            <Button variant="contained" color="error" startIcon={<Sym name="do_not_disturb_on" size={20} />} onClick={() => setAvailOpen(true)} sx={{ borderRadius: 2, fontWeight: 800, minHeight: 48 }}>
              Quick 86 Out
            </Button>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5, mt: 2 }}>
          <Box className="no-scrollbar" sx={{ display: 'flex', gap: 1, overflowX: 'auto' }}>
            {[
              ['all', 'All KOTs', counts.all],
              ['new', 'New', counts.new],
              ['prep', 'In Prep', counts.prep],
              ['ready', 'Ready', counts.ready],
              ['delayed', 'Delayed', counts.delayed],
            ].map(([v, l, n]) => (
              <Button
                key={v}
                onClick={() => setFilter(v)}
                variant={filter === v ? 'contained' : 'outlined'}
                sx={{
                  borderRadius: 999,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  minHeight: 44,
                  ...(filter === v ? { bgcolor: '#9B2F00' } : {}),
                }}
              >
                {l}
                <Box component="span" sx={{ ml: 1, px: 1, borderRadius: 999, bgcolor: filter === v ? '#fff' : '#EEE7E3', color: filter === v ? '#9B2F00' : 'inherit', fontSize: 10, fontWeight: 800 }}>
                  {n}
                </Box>
              </Button>
            ))}
          </Box>
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1, alignItems: 'center', bgcolor: '#FAF2EE', px: 2, py: 0.75, borderRadius: 2, fontSize: 10 }}>
            <Sym name="offline_bolt" size={16} />
            Polling 7s · auto-refresh
          </Box>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {!branchId ? (
        <Alert severity="info">Pick a location to see its live orders. Log in as kitchen staff, manager or owner.</Alert>
      ) : loading && orders.length === 0 ? (
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: 'repeat(3, 1fr)' } }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rectangular" height={280} sx={{ borderRadius: 2 }} />
          ))}
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
            <TextField
              inputRef={searchRef}
              size="small"
              fullWidth
              placeholder="Search table or order — T12, 1042…  (press 1)"
              value={ticketQuery}
              onChange={(e) => setTicketQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                sx: { borderRadius: 2, bgcolor: 'background.paper' },
              }}
              sx={{ flexGrow: 1 }}
            />
            <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={() => { setLoading(true); load(); }} sx={{ borderRadius: 2, flexShrink: 0 }}>
              Refresh
            </Button>
            <Button variant="outlined" size="small" disabled={actingId === 'bulk' || counts.new === 0} onClick={handleStartAll} sx={{ borderRadius: 2, flexShrink: 0, fontWeight: 800 }}>
              Start All
            </Button>
          </Box>

          {visible.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              {orders.length === 0 ? 'All clear — no live tickets on this board.' : 'No tickets match this filter.'}
            </Typography>
          )}
          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: 'repeat(3, 1fr)' },
              '@media (min-width:1700px)': { gridTemplateColumns: 'repeat(5, 1fr)' },
              alignItems: 'start',
            }}
          >
            {visible.map((o) => (
              <OrderCard key={o.id} order={o} vegOf={vegOf} onAction={handleAction} acting={actingId === o.id} now={nowMs} onReject={(ord) => { setRejectReason(''); setRejectOrder(ord); }} />
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
            Board refreshes every 7s · served orders leave automatically · keys: 1 search · 2 bump oldest · 3 quick 86
          </Typography>
        </>
      )}

      {/* reject dialog */}
      <Dialog open={!!rejectOrder} onClose={() => setRejectOrder(null)} fullWidth maxWidth="xs">
        <DialogTitle>Reject {rejectOrder?.orderNumber}?</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            The ticket leaves the board and the customer is notified. Optional reason:
          </Typography>
          <TextField label="Reason (optional)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Out of stock" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOrder(null)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={actingId} onClick={handleReject}>
            {actingId ? 'Rejecting…' : 'Reject ticket'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 86 modal */}
      <Dialog open={availOpen} onClose={() => setAvailOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Sym name="block" size={24} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" fontWeight={800} fontSize={18}>Quick 86 Stockout</Typography>
            <Typography variant="caption" fontSize={10} color="text.secondary">
              Instantly locks items on POS & Guest QR menus
            </Typography>
          </Box>
          <Button size="small" onClick={() => setAvailOpen(false)}>✕</Button>
        </DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5 }}>
          <TextField size="small" fullWidth placeholder="Search dish e.g. Tandoori Roti, Paneer..." value={availQuery} onChange={(e) => setAvailQuery(e.target.value)} />
          {availLoading && availItems === null ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gap: 1, maxHeight: 320, overflowY: 'auto' }}>
              {(availItems ?? [])
                .filter((i) => i.name.toLowerCase().includes(availQuery.trim().toLowerCase()))
                .map((i) => (
                  <Box key={i.id} sx={{ display: 'flex', gap: 1, alignItems: 'center', p: 1.5, borderRadius: 2, bgcolor: '#FAF2EE', opacity: i.available ? 1 : 0.75 }}>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={800} fontSize={14} noWrap>{i.name}</Typography>
                      <Typography variant="caption" fontSize={10} color="text.secondary">
                        {i.categoryName}{!i.available && ' · Sold out'}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="contained"
                      color={i.available ? 'error' : 'inherit'}
                      onClick={() => toggleAvail(i)}
                      sx={{ borderRadius: 2, fontWeight: 800, flexShrink: 0, ...(i.available ? {} : { bgcolor: '#EEE7E3', color: 'text.secondary' }) }}
                    >
                      {i.available ? '86 NOW' : 'Available'}
                    </Button>
                  </Box>
                ))}
              {availItems !== null && availItems.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  No items in this restaurant yet.
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Switch size="small" checked={sound} onChange={toggleSound} slotProps={{ input: { 'aria-label': 'kitchen chime' } }} />
          <Typography variant="caption" fontSize={10} color="text.secondary" sx={{ flexGrow: 1, textAlign: 'left' }}>
            Chime {sound ? 'on' : 'off'}
          </Typography>
          <Button variant="contained" onClick={() => setAvailOpen(false)} sx={{ borderRadius: 2, fontWeight: 800 }}>
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* recall drawer */}
      <Dialog open={recallOpen} onClose={() => setRecallOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Today&apos;s completed tickets</DialogTitle>
        <DialogContent>
          {recallLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (servedToday ?? []).length === 0 ? (
            <Typography variant="body2" color="text.secondary">Nothing served yet today.</Typography>
          ) : (
            <Box sx={{ display: 'grid', gap: 1 }}>
              {(servedToday ?? []).slice(0, 30).map((o) => (
                <Box key={o.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="body2" noWrap>
                    {o.orderNumber} · T{o.tableNumber}
                  </Typography>
                  <Typography variant="body2" fontWeight={700}>
                    ₹{Number(o.totalAmount ?? 0).toLocaleString('en-IN')}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRecallOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* toast */}
      {toast && (
        <Box
          sx={{
            position: 'fixed',
            bottom: { xs: 80, md: 24 },
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1400,
            bgcolor: '#1E1B19',
            color: '#fff',
            px: 2.5,
            py: 1.5,
            borderRadius: 999,
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            boxShadow: 4,
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          <Sym name="check_circle" size={18} />
          {toast}
        </Box>
      )}

      {/* mobile bottom nav */}
      <Box
        component="nav"
        sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          bgcolor: 'rgba(255,248,245,0.95)',
          backdropFilter: 'blur(20px)',
          justifyContent: 'space-around',
          alignItems: 'center',
          height: 64,
        }}
      >
        {[
          ['receipt_long', 'New', 'new'],
          ['skillet', 'Prep', 'prep'],
          ['check_circle', 'Ready', 'ready'],
          ['block', '86', '86'],
        ].map(([icon, label, v]) => (
          <Button
            key={label}
            onClick={() => (v === '86' ? setAvailOpen(true) : setFilter(v))}
            sx={{
              flexDirection: 'column',
              gap: 0,
              minWidth: 56,
              minHeight: 44,
              color: filter === v ? '#9B2F00' : 'text.secondary',
              fontWeight: filter === v ? 800 : 400,
              fontSize: 10,
              ...(v === '86' && { color: 'text.secondary', fontWeight: 400 }),
            }}
          >
            <Sym name={icon} size={22} />
            {label}
            {v !== '86' && (
              <Typography component="span" variant="caption" fontSize={10} fontWeight={800}>
                {counts[v]}
              </Typography>
            )}
          </Button>
        ))}
      </Box>

    </Box>
  );
}
