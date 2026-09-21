import RefreshIcon from '@mui/icons-material/Refresh';
import RoomServiceIcon from '@mui/icons-material/RoomService';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import {
  Alert,
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
  InputLabel,
  MenuItem,
  Paper,
  Select,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../../components/layout/PageHeader.jsx';
import { useAuth } from '../../hooks/useAuth.js';
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

/** Theme-safe status tint: soft wash band + strong ink dot. Works in light + dark. */
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
  const [sound, setSound] = useState(true);
  const [selected, setSelected] = useState(null);
  const [tick, setTick] = useState(0);
  // Ownership: full floor by default (all tables + all orders visible);
  // waiters can narrow to their tables with the toggle.
  const [mineOnly, setMineOnly] = useState(false);
  const roleInit = useRef(false);
  const knownReady = useRef(new Set());

  useEffect(() => {
    if (user && !roleInit.current) {
      roleInit.current = true;
    }
    // Fix 2: branch-scoped staff are locked to their home branch —
    // a Bangalore waiter can never open the Noida floor.
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
        if (fresh.length > 0) chime();
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
      `Table ${order.tableNumber} is ${t.assignedWaiterName}'s — complete anyway? It'll be recorded as your cover.`)) {
      return;
    }
    setActingId(order.id);
    try {
      await updateOrderStatus(order.id, 'COMPLETED');
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

  /** Covering = acting on a table owned by another waiter (allowed, but flagged). */
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

  const visibleTables = useMemo(() => {
    if (!mineOnly || !user || user.role !== 'WAITER') return tables;
    return tables.filter((t) => !t.assignedWaiterId || t.assignedWaiterId === user.userId);
  }, [tables, mineOnly, user]);

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

  /** Drawer table re-derived from live poll data so its status never goes stale. */
  const drawerTable = useMemo(() => {
    if (!selected) return null;
    return tables.find((t) => t.tableId === selected.tableId) ?? selected;
  }, [tables, selected]);

  /** Pending pay-at-counter request on the open table, if any. */
  const pendingCash = useMemo(() => {
    if (!drawerTable?.sessionId) return null;
    return (
      payments.find((p) => p.sessionId === drawerTable.sessionId && p.status === 'PENDING') ?? null
    );
  }, [payments, drawerTable]);

  const needsAttention = tables.filter((t) => t.displayStatus === 'READY').length;

  return (
    <Box>
      <PageHeader
        title="Waiter Dashboard"
        subtitle={
          branchId
            ? `${visibleTables.length}/${tables.length} tables · ${needsAttention} need attention · auto-refresh every 5s`
            : 'Pick a restaurant + branch to see the floor'
        }
        actions={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={sound ? <VolumeUpIcon /> : <VolumeOffIcon />}
              onClick={() => setSound((s) => !s)}
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
        }
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        {user?.branchId ? (
          <Alert severity="info" sx={{ flexGrow: 1 }}>
            Locked to your branch — {user.branchName ? `${user.restaurantName ?? ''} · ${user.branchName}` : 'home floor'}. Contact your owner to move branches.
          </Alert>
        ) : (
          <>
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
            <FormControl size="small" sx={{ minWidth: 200, flexGrow: 1 }}>
              <InputLabel>Branch</InputLabel>
              <Select
                value={branchId}
                label="Branch"
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
          </>
        )}
      </Paper>

      {!branchId ? (
        <Alert severity="info">Pick a restaurant + branch to see its tables. Log in as waiter, manager or owner.</Alert>
      ) : loading && tables.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={mineOnly ? 'MINE' : 'ALL'}
              onChange={(_, v) => v && setMineOnly(v === 'MINE')}
            >
              <ToggleButton value="MINE">My tables</ToggleButton>
              <ToggleButton value="ALL">All ({tables.length})</ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary">
              {mineOnly ? 'Your tables + house · covering others needs one confirm' : 'Full floor'}
            </Typography>
          </Box>
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
                        p: 1.75, borderRadius: 3, display: 'flex', gap: 2, alignItems: 'center',
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

          <Box
            sx={{
              display: 'grid',
              gap: '10px',
              gridTemplateColumns: {
                xs: '1fr 1fr 1fr',
                sm: '1fr 1fr 1fr 1fr',
                md: '1fr 1fr 1fr 1fr 1fr',
                lg: '1fr 1fr 1fr 1fr 1fr 1fr',
              },
            }}
          >
            {visibleTables.map((t) => {
              const meta = STATUS_META[t.displayStatus] ?? STATUS_META.EMPTY;
              const mine = !!user && !!t.assignedWaiterId && t.assignedWaiterId === user.userId;
              const isReady = t.displayStatus === 'READY';
              return (
                <Card
                  key={t.tableId}
                  variant="outlined"
                  sx={{
                    // Literal px radius — numeric values multiply theme.shape (16) and go oval.
                    borderRadius: '14px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 112,
                    transition: 'box-shadow .15s',
                    '&:hover': { boxShadow: 2 },
                    ...(isReady && {
                      animation: 'wpulse 2s ease-in-out infinite',
                      '@keyframes wpulse': {
                        '0%, 100%': { boxShadow: '0 0 0 0 rgba(0,0,0,0)' },
                        '50%': { boxShadow: '0 6px 18px -8px rgba(198,40,40,0.5)' },
                      },
                    }),
                  }}
                >
                  <CardActionArea
                    onClick={() => setSelected(t)}
                    sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch', textAlign: 'left' }}
                  >
                    {/* Slim status band */}
                    <Box
                      sx={(theme) => {
                        const s = statusBand(theme, meta.color);
                        return {
                          px: 1.5, py: 0.5, bgcolor: s.bg,
                          display: 'flex', alignItems: 'center', gap: 0.75,
                        };
                      }}
                    >
                      <Box
                        sx={(theme) => ({
                          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                          bgcolor: statusBand(theme, meta.color).dot,
                        })}
                      />
                      <Typography
                        variant="caption"
                        fontWeight={800}
                        noWrap
                        sx={(theme) => ({
                          color: statusBand(theme, meta.color).ink,
                          textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: 10,
                        })}
                      >
                        {meta.label}
                        {t.readyOrderCount > 0 && ` · ${t.readyOrderCount}`}
                      </Typography>
                    </Box>
                    <CardContent sx={{ px: 1.5, py: 1, flexGrow: 1, '&:last-child': { pb: 1 } }}>
                      <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.01em', lineHeight: 1.15, fontSize: 20 }}>
                        {t.tableNumber}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, fontSize: 12 }} noWrap>
                        {t.seatingCapacity} seats · {mine ? 'My table' : ownerTag(t)}
                      </Typography>
                      <Box sx={{ mt: 0.25, display: 'grid', minHeight: 32 }}>
                        {t.activeOrderCount > 0 ? (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 12 }} noWrap>
                            {t.activeOrderCount} live · oldest {elapsed(t.oldestPlacedAt)}
                          </Typography>
                        ) : (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 12 }} noWrap>
                            {t.sessionId ? 'Seated · no live orders' : 'No active session'}
                          </Typography>
                        )}
                        {t.sessionId && t.paymentStatus && (
                          <Typography
                            variant="caption"
                            fontWeight={700}
                            noWrap
                            color={
                              t.paymentStatus === 'PAID'
                                ? 'success.main'
                                : t.paymentStatus === 'PARTIAL'
                                  ? 'warning.main'
                                  : 'text.secondary'
                            }
                            sx={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}
                          >
                            {t.paymentStatus === 'PAID'
                              ? `Paid${t.pendingCash ? ' · cash?' : ''}`
                              : t.paymentStatus === 'PARTIAL'
                                ? `Due ₹${Number(t.balanceDue ?? 0).toFixed(2)}${t.pendingCash ? ' · cash?' : ''}`
                                : `Unpaid${t.pendingCash ? ' · cash?' : ''}`}
                          </Typography>
                        )}
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              );
            })}
          </Box>
          {tables.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No tables yet — add them under Restaurants → Branch → Tables.
            </Typography>
          )}
          {tables.length > 0 && visibleTables.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No tables assigned to you yet — switch to All or ask your manager.
            </Typography>
          )}
        </>
      )}

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
            borderRadius: { xs: '20px 20px 0 0', sm: '20px' },
          },
        }}
      >
        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 64px)' }}>
          {drawerTable && (
            <>
              {/* Sticky header — never clips, never scrolls away */}
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
                {/* Payment band — always visible on an open table */}
                {drawerTable.sessionId && drawerTable.paymentStatus && (
                  <Paper
                    variant="outlined"
                    sx={{
                      mt: 1.5, p: 1.5, borderRadius: 3, display: 'flex',
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
              {/* Scrollable orders zone — poll refreshes never move header/footer */}
              <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 2.5, py: 2 }}>
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
                    <Paper key={o.id} variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}>
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
                          sx={{ mt: 1 }}
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
                          sx={{ mt: 1 }}
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
              {/* Sticky footer — actions always in reach */}
              <Box sx={{ p: 2.5, pt: 1.5, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
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
              {user && user.role !== 'WAITER' && Number(drawerTable.balanceDue ?? 0) > 0 && liveSelected.length === 0 && (
                <Button
                  fullWidth
                  variant="text"
                  color="warning"
                  sx={{ mt: 1 }}
                  disabled={!drawerTable.sessionId || closing}
                  onClick={() => handleClose(drawerTable, true)}
                >
                  Force-close unpaid (manager)
                </Button>
              )}
              {pendingCash && (
                <Button
                  fullWidth
                  variant="contained"
                  color="success"
                  sx={{ mt: 1.5 }}
                  disabled={actingId === pendingCash.id}
                  onClick={() => handleCollect(pendingCash, drawerTable)}
                >
                  {actingId === pendingCash.id
                    ? 'Updating…'
                    : `Mark ₹${Number(pendingCash.total ?? 0).toFixed(2)} Cash Collected ✓`}
                </Button>
              )}
              </Box>
            </>
          )}
        </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
