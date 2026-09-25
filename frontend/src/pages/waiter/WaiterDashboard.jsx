import RefreshIcon from '@mui/icons-material/Refresh';
import RoomServiceIcon from '@mui/icons-material/RoomService';
import SearchIcon from '@mui/icons-material/Search';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import OverrideModal from '../../components/OverrideModal.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { buzz, getChime, setChimePref } from '../../utils/devicePrefs.js';
import { searchOrders, updateOrderStatus } from '../../services/kitchen.js';
import { completeCashPayment, listPayments } from '../../services/payment.js';
import { listBranches, listRestaurants } from '../../services/restaurant.js';
import { closeSession, getTableStatus } from '../../services/waiter.js';

const BRANCH_KEY = 'tp_waiter_branch';
const POLL_MS = 5000;

const STATUS_META = {
  EMPTY: { label: 'Empty', color: 'success' },
  OCCUPIED: { label: 'Seated', color: 'neutral' },
  ORDERED: { label: 'Ordered', color: 'warning' },
  PREPARING: { label: 'Preparing', color: 'info' },
  READY: { label: 'Ready to serve', color: 'error' },
};

function statusBand(theme, color) {
  if (color === 'neutral') {
    return { bg: theme.palette.action.hover, ink: theme.palette.text.secondary, dot: theme.palette.text.disabled };
  }
  const main = theme.palette[color]?.main ?? theme.palette.primary.main;
  return { bg: alpha(main, 0.12), ink: main, dot: main };
}

function elapsed(placedAt) {
  const ms = Date.now() - new Date(placedAt).getTime();
  const min = Math.max(0, Math.floor(ms / 60000));
  if (min < 1) return 'just now';
  if (min === 1) return '1 min ago';
  if (min < 60) return `${min} min ago`;
  return `${Math.floor(min / 60)}h ${min % 60}m ago`;
}

function elapsedMin(placedAt) {
  try {
    return Math.max(0, (Date.now() - new Date(placedAt).getTime()) / 60000);
  } catch {
    return 0;
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
    // audio not available — dashboard still works
  }
}

function orderSummary(order) {
  return (order.items ?? []).map((it) => `${it.menuItemName} × ${it.quantity}`).join(', ');
}

function Sym({ name, size = 18 }) {
  return (
    <Box component="span" className="material-symbols-outlined" sx={{ fontSize: size, display: 'inline-flex' }}>
      {name}
    </Box>
  );
}

const inr2 = (n) => `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function WaiterDashboard() {
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantId, setRestaurantId] = useState('');
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(() => localStorage.getItem(BRANCH_KEY) ?? '');
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actingId, setActingId] = useState(null);
  const [closing, setClosing] = useState(false);
  const [sound, setSound] = useState(getChime);
  const [selected, setSelected] = useState(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all'); // all | mine | ready | bills | delayed
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState(null);
  const roleInit = useRef(false);
  const knownReady = useRef(new Set());
  const toastTimer = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  const toggleSound = () => {
    setSound((s) => {
      setChimePref(!s);
      return !s;
    });
  };

  useEffect(() => {
    if (user && !roleInit.current) {
      roleInit.current = true;
    }
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
      const [st, od, pm] = await Promise.all([
        getTableStatus(branchId),
        searchOrders({ branchId }),
        listPayments({ branchId }),
      ]);
      setTables(st.data ?? []);
      setPayments(pm.data ?? []);
      const list = od.data ?? [];
      if (sound && knownReady.current.size > 0) {
        const fresh = list.filter((o) => o.status === 'READY' && !knownReady.current.has(o.id));
        if (fresh.length > 0) {
          chime();
          buzz([120, 60, 120]);
        }
      }
      knownReady.current = new Set(list.filter((o) => o.status === 'READY').map((o) => o.id));
      setOrders(list);
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

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  async function handleServe(order) {
    const t = tables.find((x) => x.tableNumber === order.tableNumber);
    if (isCover(t) && !window.confirm(
      `Table ${order.tableNumber} is ${t.assignedWaiterName}'s — serve anyway? It'll be recorded as your cover.`)) {
      return;
    }
    setActingId(order.id);
    try {
      await updateOrderStatus(order.id, 'SERVED');
      showToast(`Table ${order.tableNumber} marked served.`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActingId(null);
    }
  }

  async function handleComplete(order) {
    const t = tables.find((x) => x.tableNumber === order.tableNumber);
    if (isCover(t) && !window.confirm(
      `Table ${order.tableNumber} is ${t.assignedWaiterId}'s — complete anyway? It'll be recorded as your cover.`)) {
      return;
    }
    setActingId(order.id);
    try {
      await updateOrderStatus(order.id, 'COMPLETED');
      showToast(`${order.orderNumber} completed.`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActingId(null);
    }
  }

  async function handleCollect(payment, table) {
    if (isCover(table) && !window.confirm(
      `Table ${table.tableNumber} is ${table.assignedWaiterName}'s — collect anyway? It'll be recorded as your cover.`)) {
      return;
    }
    setActingId(payment.id);
    try {
      await completeCashPayment(payment.id);
      showToast(`₹${Number(payment.total ?? 0).toFixed(2)} cash collected.`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActingId(null);
    }
  }

  async function handleClose(table, force = false) {
    if (!table.sessionId) return;
    if (isCover(table) && !window.confirm(
      `Table ${table.tableNumber} is ${table.assignedWaiterName}'s — close anyway? It'll be recorded as your cover.`)) {
      return;
    }
    const due = Number(table.balanceDue ?? 0);
    if (force && due > 0 && !window.confirm(
      `Table ${table.tableNumber} still owes ₹${due.toFixed(2)} — force-close anyway?`)) {
      return;
    }
    setClosing(true);
    try {
      await closeSession(table.sessionId, force);
      setSelected(null);
      showToast(`Table ${table.tableNumber} closed.`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setClosing(false);
    }
  }

  const readyOrders = useMemo(
    () => orders.filter((o) => o.status === 'READY'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, tick],
  );

  const delayedOrders = useMemo(
    () => orders.filter((o) => ['PLACED', 'ACCEPTED', 'PREPARING'].includes(o.status) && elapsedMin(o.placedAt) >= 10),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, tick],
  );

  const billTables = useMemo(
    () => tables.filter((t) => t.sessionId && t.paymentStatus && t.paymentStatus !== 'PAID'),
    [tables],
  );

  function isCover(table) {
    return !!user && user.role === 'WAITER'
      && !!table?.assignedWaiterId && table.assignedWaiterId !== user.userId;
  }

  function ownerTag(table) {
    if (!table) return '';
    if (!table.assignedWaiterId) return 'House';
    if (user && table.assignedWaiterId === user.userId) return '· Mine';
    return `· ${table.assignedWaiterName ?? 'assigned'}`;
  }

  /** Live money + ticket refs per table, joined from today's orders. */
  const tableLive = useMemo(() => {
    const map = {};
    for (const o of orders) {
      if (o.tableNumber == null || ['CANCELLED', 'REJECTED', 'COMPLETED'].includes(o.status)) continue;
      const k = String(o.tableNumber);
      map[k] = map[k] ?? { total: 0, numbers: [], items: '' };
      map[k].total += Number(o.totalAmount ?? 0);
      map[k].numbers.push(o.orderNumber);
      if (!map[k].items) map[k].items = orderSummary(o);
    }
    return map;
  }, [orders]);

  const visibleTables = useMemo(() => {
    let list = tables;
    if (statusFilter === 'mine') {
      list = (user && user.role === 'WAITER')
        ? list.filter((t) => !t.assignedWaiterId || t.assignedWaiterId === user.userId)
        : list.filter((t) => !t.assignedWaiterId);
    } else if (statusFilter === 'ready') {
      list = list.filter((t) => t.displayStatus === 'READY');
    } else if (statusFilter === 'bills') {
      list = list.filter((t) => t.sessionId && t.paymentStatus && t.paymentStatus !== 'PAID');
    } else if (statusFilter === 'delayed') {
      const nums = new Set(delayedOrders.map((o) => String(o.tableNumber)));
      list = list.filter((t) => nums.has(String(t.tableNumber)));
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((t) =>
        `${t.tableNumber ?? ''} ${(t.assignedWaiterName ?? '').toLowerCase()}`.toLowerCase().includes(q),
      );
    }
    return list;
  }, [tables, statusFilter, user, delayedOrders, query]);

  const visibleNumbers = useMemo(() => new Set(visibleTables.map((t) => t.tableNumber)), [visibleTables]);
  const visibleReady = useMemo(
    () => readyOrders.filter((o) => visibleNumbers.has(o.tableNumber)),
    [readyOrders, visibleNumbers],
  );

  const selectedOrders = useMemo(() => {
    if (!selected) return [];
    const weight = { PLACED: 0, ACCEPTED: 1, PREPARING: 2, READY: 3, SERVED: 4 };
    return orders
      .filter(
        (o) =>
          o.tableNumber === selected.tableNumber &&
          ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED'].includes(o.status),
      )
      .sort((a, b) => (weight[a.status] ?? 9) - (weight[b.status] ?? 9));
  }, [orders, selected]);

  const liveSelected = useMemo(
    () => selectedOrders.filter((o) => o.status !== 'SERVED'),
    [selectedOrders],
  );

  const drawerTable = useMemo(() => {
    if (!selected) return null;
    return tables.find((t) => t.tableId === selected.tableId) ?? selected;
  }, [tables, selected]);

  const pendingCash = useMemo(() => {
    if (!drawerTable?.sessionId) return null;
    return (
      payments.find((p) => p.sessionId === drawerTable.sessionId && p.status === 'PENDING') ?? null
    );
  }, [payments, drawerTable]);

  const needsAttention = tables.filter((t) => t.displayStatus === 'READY').length;
  const occupiedCount = tables.filter((t) => t.displayStatus !== 'EMPTY').length;
  const branchName = branches.find((b) => b.id === branchId)?.name ?? (user?.branchName ?? 'Floor');

  return (
    <Box sx={{ pb: { xs: '64px', md: 0 } }}>
      {/* greeting (mobile-first card, harmless on desktop) */}
      <Card sx={{ borderRadius: 2, mb: 2, display: { xs: 'block', md: 'none' } }}>
        <CardContent sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Avatar sx={{ bgcolor: '#9B2F00', fontWeight: 800, width: 44, height: 44 }}>
            {user?.fullName?.[0]?.toUpperCase() ?? 'W'}
          </Avatar>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="h6" fontWeight={800} fontSize={18} noWrap>
              {user?.fullName ?? 'Waiter'}
            </Typography>
            <Typography variant="caption" fontSize={10} color="text.secondary" noWrap sx={{ display: 'block' }}>
              {branchName} · {user?.role === 'WAITER' ? 'Captain' : (user?.role ?? '')}
            </Typography>
          </Box>
          <Chip
            size="small"
            icon={<Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#00632B', ml: 1 }} />}
            label="Live Shift"
            sx={{ bgcolor: 'rgba(17,126,59,.1)', color: '#00632B', fontWeight: 800, fontSize: 10 }}
          />
        </CardContent>
      </Card>

      {/* KPI strip */}
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, mb: 2 }}>
        {[
          ['table_bar', 'Floor Occupancy', `${occupiedCount}/${tables.length}`, needsAttention > 0 ? `${needsAttention} need attention` : 'All calm', '#9B2F00'],
          ['soup_kitchen', 'Active Kitchen KOTs', `${orders.filter((o) => ['PLACED', 'ACCEPTED', 'PREPARING'].includes(o.status)).length} Live`, delayedOrders.length > 0 ? `${delayedOrders.length} Delayed (T-${delayedOrders[0].tableNumber})` : 'No delays', '#C2410C'],
          ['room_service', 'Kitchen Pass Ready', `${readyOrders.length} Orders`, readyOrders.length > 0 ? 'Claim from the list below' : 'Nothing waiting', '#00632B'],
          ['receipt_long', 'Bills Awaiting Settle', `${billTables.length} Tables`, billTables.length > 0 ? billTables.slice(0, 2).map((t) => `T-${t.tableNumber}`).join(', ') : 'All settled', '#006A63'],
        ].map(([icon, label, value, sub]) => (
          <Card key={label} sx={{ borderRadius: 2 }}>
            <CardContent sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Avatar sx={{ bgcolor: '#FAF2EE', color: '#9B2F00', borderRadius: 2, width: 44, height: 44 }}>
                <Sym name={icon} size={22} />
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" fontWeight={800} fontSize={10} color="text.secondary" sx={{ textTransform: 'uppercase', display: 'block' }}>
                  {label}
                </Typography>
                <Typography variant="h6" fontWeight={800} fontSize={20} noWrap>
                  {value}
                </Typography>
                <Typography variant="caption" fontSize={10} color="text.secondary" noWrap sx={{ display: 'block' }}>
                  {sub}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        {user?.branchId ? (
          <Alert severity="info" sx={{ flexGrow: 1 }}>
            Locked to your location — {user.branchName ? `${user.restaurantName ?? ''} · ${user.branchName}` : 'home floor'}. Contact your owner to move locations.
          </Alert>
        ) : (
          <>
            {restaurants.length > 1 && (
              <FormControl size="small" sx={{ minWidth: 200, flexGrow: 1 }}>
                <InputLabel>Restaurant</InputLabel>
                <Select value={restaurantId} label="Restaurant" onChange={(e) => setRestaurantId(e.target.value)}>
                  {restaurants.map((r) => (
                    <MenuItem key={r.id} value={r.id}>
                      {r.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {branches.length > 1 && (
              <FormControl size="small" sx={{ minWidth: 200, flexGrow: 1 }}>
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
                    <MenuItem key={b.id} value={b.id}>
                      {b.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </>
        )}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={sound ? <VolumeUpIcon /> : <VolumeOffIcon />}
            onClick={toggleSound}
          >
            {sound ? 'Sound on' : 'Muted'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              setLoading(true);
              load();
            }}
          >
            Refresh
          </Button>
        </Box>
      </Paper>

      {!branchId ? (
        <Alert severity="info">Pick a location to see its tables. Log in as waiter, manager or owner.</Alert>
      ) : loading && tables.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* search + status filters */}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
            <TextField
              size="small"
              placeholder="Search table or waiter — T08, Ajay…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              sx={{ flexGrow: 1, minWidth: 200, maxWidth: 420, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#fff' } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          <Box className="no-scrollbar" sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5, mb: 2 }}>
            {[
              ['all', `All (${tables.length})`, null],
              ['mine', `My Tables (${tables.filter((t) => !t.assignedWaiterId || (user && t.assignedWaiterId === user.userId)).length})`, null],
              ['ready', `Ready Pickup (${visibleReady.length})`, 'green'],
              ['bills', `Need Bill (${billTables.length})`, 'orange'],
              ['delayed', `Delayed (${delayedOrders.length})`, 'red'],
            ].map(([v, l, tone]) => (
              <Chip
                key={v}
                clickable
                onClick={() => setStatusFilter(v)}
                label={l}
                sx={statusFilter === v
                  ? { bgcolor: '#9B2F00', color: '#fff', fontWeight: 800, fontSize: 12 }
                  : tone === 'green'
                    ? { bgcolor: 'rgba(17,126,59,.1)', color: '#00632B', fontWeight: 800, fontSize: 12 }
                    : tone === 'orange'
                      ? { bgcolor: '#FFDBD0', color: '#9B2F00', fontWeight: 800, fontSize: 12 }
                      : tone === 'red'
                        ? { bgcolor: '#FFDAD6', color: '#BA1A1A', fontWeight: 800, fontSize: 12 }
                        : { bgcolor: '#fff', fontWeight: 600, fontSize: 12 }}
              />
            ))}
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', ml: 'auto', flexShrink: 0 }}>
              Live Mesh · 5s Ping
            </Typography>
          </Box>

          {/* legend */}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2, fontSize: 10, fontWeight: 700, color: 'text.secondary' }}>
            <span>Status Legend:</span>
            {[
              ['Vacant', '#00632B'],
              ['Dining / In Prep', '#C2410C'],
              ['Food Ready', '#00632B'],
              ['Bill Pending', '#006A63'],
              ['Delayed', '#BA1A1A'],
            ].map(([l, c]) => (
              <Box key={l} sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c }} />
                {l}
              </Box>
            ))}
          </Box>

          {/* runner pass banner */}
          {visibleReady[0] && (
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', justifyContent: 'space-between', bgcolor: 'rgba(0,106,99,.08)', borderRadius: 2, p: 1.5, mb: 2 }}>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', minWidth: 0 }}>
                <Avatar sx={{ bgcolor: '#006A63', borderRadius: 2, width: 32, height: 32 }}>
                  <Sym name="room_service" size={18} />
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={800} fontSize={14} noWrap>
                    {visibleReady.length} item{visibleReady.length === 1 ? '' : 's'} ready at Kitchen Pass
                  </Typography>
                  <Typography variant="caption" fontSize={10} color="text.secondary" noWrap sx={{ display: 'block' }}>
                    {orderSummary(visibleReady[0])}
                  </Typography>
                </Box>
              </Box>
              <Button size="small" variant="contained" disabled={actingId === visibleReady[0].id} onClick={() => handleServe(visibleReady[0])} sx={{ borderRadius: 2, bgcolor: '#006A63', flexShrink: 0 }}>
                {actingId === visibleReady[0].id ? '…' : 'Claim Runner'}
              </Button>
            </Box>
          )}

          {visibleReady.length > 0 && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1, letterSpacing: '-0.01em' }}>
                Ready to serve ({visibleReady.length})
              </Typography>
              <Box sx={{ display: 'grid', gap: 1 }}>
                {visibleReady.map((o) => {
                  const t = tables.find((x) => x.tableNumber === o.tableNumber);
                  return (
                    <Paper
                      key={o.id}
                      variant="outlined"
                      sx={{
                        p: 1.75, borderRadius: 2, display: 'flex', gap: 2, alignItems: 'center',
                        borderLeft: 4, borderLeftColor: 'error.main',
                      }}
                    >
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="subtitle1" fontWeight={800} sx={{ letterSpacing: '-0.01em' }}>
                          Table {o.tableNumber}
                          <Typography component="span" variant="body2" color="text.secondary" fontWeight={400}>
                            {t ? ` ${ownerTag(t)}` : ''} · {o.orderNumber} · {elapsed(o.placedAt)}
                          </Typography>
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {orderSummary(o)}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={actingId === o.id}
                        onClick={() => handleServe(o)}
                        sx={{ flexShrink: 0 }}
                      >
                        {actingId === o.id ? '…' : 'Mark Served'}
                      </Button>
                    </Paper>
                  );
                })}
              </Box>
            </Box>
          )}

          {/* floor grid */}
          <Box
            sx={{
              display: 'grid',
              gap: '10px',
              gridTemplateColumns: {
                xs: '1fr',
                sm: '1fr 1fr',
                lg: '1fr 1fr 1fr',
              },
            }}
          >
            {visibleTables.map((t) => {
              const meta = STATUS_META[t.displayStatus] ?? STATUS_META.EMPTY;
              const mine = !!user && !!t.assignedWaiterId && t.assignedWaiterId === user.userId;
              const isReady = t.displayStatus === 'READY';
              const isDelayed = delayedOrders.some((o) => String(o.tableNumber) === String(t.tableNumber));
              const live = tableLive[String(t.tableNumber)];
              const billed = t.sessionId && t.paymentStatus && t.paymentStatus !== 'PAID';
              return (
                <Card
                  key={t.tableId}
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 218,
                    ...(isDelayed
                      ? { border: 2, borderColor: 'error.main' }
                      : isReady
                        ? { border: 2, borderColor: '#00632B' }
                        : billed
                          ? { border: 2, borderColor: '#006A63' }
                          : t.displayStatus === 'EMPTY'
                            ? { borderStyle: 'dashed' }
                            : {}),
                    ...(isReady && {
                      animation: 'wpulse 2s ease-in-out infinite',
                      '@keyframes wpulse': {
                        '0%, 100%': { boxShadow: '0 0 0 0 rgba(0,0,0,0)' },
                        '50%': { boxShadow: '0 6px 18px -8px rgba(0,99,43,0.55)' },
                      },
                    }),
                  }}
                >
                  <CardActionArea
                    onClick={() => setSelected(t)}
                    sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch', textAlign: 'left', p: 2, gap: 1.25 }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                      <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
                        <Avatar sx={{ bgcolor: isDelayed ? '#BA1A1A' : isReady ? '#00632B' : '#FAF2EE', color: isDelayed || isReady ? '#fff' : '#9B2F00', borderRadius: 2, width: 36, height: 36, fontWeight: 800 }}>
                          {String(t.tableNumber).replace(/^T-?/i, '')}
                        </Avatar>
                        <Box>
                          <Typography variant="h6" fontWeight={800} fontSize={15} sx={{ lineHeight: 1.1 }}>
                            Table {t.tableNumber}
                          </Typography>
                          <Typography variant="caption" fontSize={10} color="text.secondary">
                            {t.seatingCapacity} seats · {mine ? 'My table' : ownerTag(t)}
                          </Typography>
                        </Box>
                      </Box>
                      <Box
                        sx={(theme) => {
                          const s = statusBand(theme, isDelayed ? 'error' : meta.color);
                          return {
                            px: 1, py: 0.5, borderRadius: 999, bgcolor: s.bg, color: s.ink,
                            fontSize: 10, fontWeight: 800, display: 'flex', gap: 0.5, alignItems: 'center', flexShrink: 0,
                          };
                        }}
                      >
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'currentColor' }} />
                        {isDelayed ? 'DELAYED' : meta.label.toUpperCase()}
                      </Box>
                    </Box>
                    <Box sx={{ bgcolor: '#FAF2EE', borderRadius: 2, p: 1.25, fontSize: 12, minHeight: 52 }}>
                      {live ? (
                        <>
                          <Typography variant="body2" fontSize={12} noWrap sx={{ fontWeight: 600 }}>
                            {live.items.split(', ').slice(0, 2).join(', ')}
                          </Typography>
                          <Typography variant="caption" fontSize={10} color="text.secondary">
                            {live.numbers.slice(0, 2).join(' · ')}
                            {t.paymentStatus === 'PARTIAL' ? ` · Due ${inr2(t.balanceDue)}` : ''}
                          </Typography>
                        </>
                      ) : t.sessionId ? (
                        <Typography variant="body2" fontSize={12} color="text.secondary">
                          Seated · no live orders
                        </Typography>
                      ) : (
                        <Typography variant="body2" fontSize={12} color="text.secondary">
                          Sanitized · Table Vacant
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 1, borderTop: 1, borderColor: 'divider' }}>
                      <Typography variant="h6" fontWeight={800} fontSize={14}>
                        {live && live.total > 0 ? inr2(live.total) : t.sessionId && t.balanceDue != null && Number(t.balanceDue) > 0 ? inr2(t.balanceDue) : '—'}
                      </Typography>
                      {isReady ? (
                        <Button
                          size="small"
                          variant="contained"
                          sx={{ borderRadius: 2, bgcolor: '#00632B', fontWeight: 800 }}
                          disabled={actingId != null}
                          onClick={(e) => {
                            e.stopPropagation();
                            const o = orders.find((x) => x.tableNumber === t.tableNumber && x.status === 'READY');
                            if (o) handleServe(o);
                            else setSelected(t);
                          }}
                        >
                          {actingId ? '…' : 'Mark Served'}
                        </Button>
                      ) : isDelayed ? (
                        <Button
                          size="small"
                          variant="contained"
                          color="error"
                          component={RouterLink}
                          to="/kitchen"
                          onClick={(e) => e.stopPropagation()}
                          sx={{ borderRadius: 2, fontWeight: 800 }}
                        >
                          Nudge Kitchen
                        </Button>
                      ) : billed ? (
                        <Button
                          size="small"
                          variant="contained"
                          sx={{ borderRadius: 2, bgcolor: '#006A63', fontWeight: 800 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(t);
                          }}
                        >
                          Settle Bill
                        </Button>
                      ) : t.displayStatus === 'EMPTY' ? (
                        <Typography variant="caption" fontSize={10} color="text.secondary">
                          Tap for folio
                        </Typography>
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(t);
                          }}
                          sx={{ borderRadius: 2, fontWeight: 700 }}
                        >
                          Open Folio
                        </Button>
                      )}
                    </Box>
                  </CardActionArea>
                </Card>
              );
            })}
          </Box>
          {tables.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No tables yet — add them under Restaurants → Tables.
            </Typography>
          )}
          {tables.length > 0 && visibleTables.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No tables match this view — clear the search or pick another filter.
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
            Board refreshes every 5s · covering another waiter&apos;s table asks once, then proceeds
          </Typography>
        </>
      )}

      {/* inspector sheet (shared desktop + mobile peek) */}
      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        fullWidth
        maxWidth="sm"
        sx={{
          '& .MuiDialog-container': {
            alignItems: { xs: 'flex-end', sm: 'center' },
          },
          '& .MuiPaper-root': {
            m: { xs: 0, sm: 2 },
            width: { xs: '100%', sm: 'calc(100% - 32px)' },
            maxHeight: { xs: '92vh', sm: 'calc(100% - 64px)' },
            borderRadius: { xs: '28px 28px 0 0', sm: '8px' },
          },
        }}
      >
        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 64px)' }}>
          {drawerTable && (
            <>
              <Box sx={{ display: { xs: 'block', sm: 'none' }, pt: 1.5, mx: 'auto' }}>
                <Box sx={{ width: 48, height: 6, borderRadius: 999, bgcolor: '#E1BFB5' }} />
              </Box>
              <Box sx={{ p: 2.5, pb: 1.5, bgcolor: 'background.paper', zIndex: 1, borderBottom: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography variant="h5" fontWeight={800} sx={{ flexGrow: 1, letterSpacing: '-0.02em' }}>
                    Table {drawerTable.tableNumber}
                  </Typography>
                  <Chip
                    size="small"
                    label={STATUS_META[drawerTable.displayStatus]?.label ?? drawerTable.displayStatus}
                    color={STATUS_META[drawerTable.displayStatus]?.color === 'neutral' ? 'default' : (STATUS_META[drawerTable.displayStatus]?.color ?? 'default')}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {drawerTable.seatingCapacity} seats
                  {drawerTable.oldestPlacedAt && ` · oldest ${elapsed(drawerTable.oldestPlacedAt)}`}
                  {' · '}Owner: {drawerTable.assignedWaiterName ?? 'House (any waiter)'}
                </Typography>
                {drawerTable.sessionId && drawerTable.paymentStatus && (
                  <Paper
                    variant="outlined"
                    sx={{
                      mt: 1.5, p: 1.5, borderRadius: 2, display: 'flex',
                      alignItems: 'center', justifyContent: 'space-between',
                      borderLeft: 4,
                      borderLeftColor: drawerTable.paymentStatus === 'PAID' ? 'success.main' : 'warning.main',
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle2" fontWeight={800}>
                        {drawerTable.paymentStatus === 'PAID'
                          ? 'Paid in full'
                          : drawerTable.paymentStatus === 'PARTIAL'
                            ? 'Partially paid'
                            : 'Unpaid'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {pendingCash
                          ? 'Cash collection pending at the table'
                          : drawerTable.paymentStatus === 'PAID'
                            ? 'Bill settled — close when served'
                            : 'Collect before closing'}
                      </Typography>
                    </Box>
                    <Typography variant="h6" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {drawerTable.paymentStatus === 'PAID'
                        ? `₹${Number(drawerTable.paidTotal ?? 0).toFixed(2)}`
                        : `₹${Number(drawerTable.balanceDue ?? 0).toFixed(2)} due`}
                    </Typography>
                  </Paper>
                )}
              </Box>
              <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 2.5, py: 2 }}>
              <Typography variant="caption" fontWeight={800} fontSize={10} color="text.secondary" sx={{ textTransform: 'uppercase', display: 'block', mb: 1 }}>
                Live KOT Items ({selectedOrders.length})
              </Typography>
              {selectedOrders.length === 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  {drawerTable.sessionId
                    ? 'Seated — no orders on this table yet.'
                    : 'Empty — no active session on this table.'}
                </Alert>
              ) : liveSelected.length === 0 ? (
                <Alert severity="success" sx={{ mb: 2 }}>
                  All orders served — complete them per row or close the table.
                </Alert>
              ) : null}
              {selectedOrders.length > 0 && (
                <Box sx={{ display: 'grid', gap: 1.25, mb: 2 }}>
                  {selectedOrders.map((o) => (
                    <Paper key={o.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="subtitle2" fontWeight={800}>
                          {o.orderNumber}
                        </Typography>
                        <Chip size="small" label={o.status} />
                        <Box sx={{ flexGrow: 1 }} />
                        <Typography variant="caption" color="text.secondary">
                          ⏱ {elapsed(o.placedAt)}
                        </Typography>
                      </Box>
                      <Typography variant="body2">{orderSummary(o)}</Typography>
                      <Typography variant="body2" fontWeight={800}>{inr2(o.totalAmount)}</Typography>
                      {o.servedBy && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Served by {o.servedBy}
                          {drawerTable.assignedWaiterId && o.servedBy !== drawerTable.assignedWaiterName && ' (cover)'} ✓
                        </Typography>
                      )}
                      {o.status === 'READY' && (
                        <Button
                          fullWidth
                          size="small"
                          variant="contained"
                          sx={{ mt: 1, borderRadius: 2, bgcolor: '#00632B' }}
                          disabled={actingId === o.id}
                          onClick={() => handleServe(o)}
                        >
                          {actingId === o.id ? 'Updating…' : 'Mark Served ✓'}
                        </Button>
                      )}
                      {o.status === 'SERVED' && (
                        <Button
                          fullWidth
                          size="small"
                          variant="outlined"
                          sx={{ mt: 1, borderRadius: 2 }}
                          disabled={actingId === o.id}
                          onClick={() => handleComplete(o)}
                        >
                          {actingId === o.id ? 'Updating…' : 'Complete ✓'}
                        </Button>
                      )}
                    </Paper>
                  ))}
                </Box>
              )}
              {pendingCash && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  ₹{Number(pendingCash.total ?? 0).toFixed(2)} cash pending — collect at the table,
                  then mark it collected to close out.
                </Alert>
              )}
              </Box>
              <Box sx={{ p: 2.5, pt: 1.5, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Sym name="shield_person" size={18} />}
                  onClick={() => setOverrideOpen(true)}
                  sx={{ borderRadius: 2, fontWeight: 700, mb: 1.5 }}
                >
                  Request void / discount override
                </Button>
                {(() => {
                  const due = Number(drawerTable.balanceDue ?? 0);
                  const blockedReason = !drawerTable.sessionId
                    ? 'No active session on this table'
                    : liveSelected.length > 0
                      ? `Serve or cancel ${liveSelected.length} live order${liveSelected.length === 1 ? '' : 's'} first`
                      : due > 0
                        ? `Collect ₹${due.toFixed(2)} first`
                        : null;
                  return (
                    <>
                      <Button
                        fullWidth
                        variant={blockedReason ? 'outlined' : 'contained'}
                        startIcon={<RoomServiceIcon />}
                        disabled={!drawerTable.sessionId || closing || !!blockedReason}
                        onClick={() => handleClose(drawerTable)}
                        sx={{ borderRadius: 2, fontWeight: 800, ...(blockedReason ? {} : { bgcolor: '#00632B' }) }}
                        title={blockedReason ?? 'Close table'}
                      >
                        {closing ? 'Closing…' : 'Close Table'}
                      </Button>
                      {blockedReason && drawerTable.sessionId && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                          {blockedReason}
                        </Typography>
                      )}
                    </>
                  );
                })()}
              </Box>
              {pendingCash && (
                <Box sx={{ px: 2.5, pb: 2.5, bgcolor: 'background.paper' }}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="success"
                    disabled={actingId === pendingCash.id}
                    onClick={() => handleCollect(pendingCash, drawerTable)}
                    sx={{ borderRadius: 2, fontWeight: 800 }}
                  >
                    {actingId === pendingCash.id
                      ? 'Updating…'
                      : `Mark ₹${Number(pendingCash.total ?? 0).toFixed(2)} Cash Collected ✓`}
                  </Button>
                </Box>
              )}
            </>
          )}
        </Box>
        </DialogContent>
      </Dialog>

      <OverrideModal
        open={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        table={drawerTable}
        order={liveSelected[0] ?? selectedOrders[0] ?? null}
      />

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
          ['table_restaurant', 'Floor', null, true],
          ['skillet', 'KDS', '/kitchen', false],
          ['account_circle', 'Profile', '/profile', false],
        ].map(([icon, label, to, active]) => (
          <Button
            key={label}
            component={to ? RouterLink : 'button'}
            to={to ?? undefined}
            sx={{ flexDirection: 'column', gap: 0, minWidth: 56, minHeight: 44, color: active ? '#9B2F00' : 'text.secondary', fontWeight: active ? 800 : 400, fontSize: 10 }}
          >
            <Sym name={icon} size={22} />
            {label}
          </Button>
        ))}
      </Box>

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
    </Box>
  );
}
