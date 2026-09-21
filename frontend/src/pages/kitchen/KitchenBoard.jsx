import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import { alpha } from '@mui/material/styles';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../../components/layout/PageHeader.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { searchOrders, updateOrderStatus } from '../../services/kitchen.js';
import { listCategories, listItems, setAvailability } from '../../services/menu.js';
import { listBranches, listRestaurants } from '../../services/restaurant.js';

const BRANCH_KEY = 'tp_kds_branch';
const POLL_MS = 7000;

const COLUMNS = [
  { key: 'NEW', title: 'New', statuses: ['PLACED'], color: 'warning' },
  { key: 'PREP', title: 'Preparing', statuses: ['ACCEPTED', 'PREPARING'], color: 'info' },
  { key: 'READY', title: 'Ready', statuses: ['READY'], color: 'success' },
];

/** Urgency ramp shared by every live ticket: neutral <5m, amber 5–10m, red 10m+. */
function urgency(mins) {
  if (mins >= 10) return 'late';
  if (mins >= 5) return 'warn';
  return 'fresh';
}

const URGENCY = {
  fresh: { label: null, color: 'text.secondary' },
  warn: { label: 'Running long', color: 'warning.main' },
  late: { label: 'Prioritize', color: 'error.main' },
};

const NEXT_ACTION = { PLACED: 'ACCEPTED', ACCEPTED: 'PREPARING', PREPARING: 'READY', READY: 'SERVED' };
const ACTION_LABEL = { ACCEPTED: 'Accept', PREPARING: 'Preparing →', READY: 'Ready ✓', SERVED: 'Served ✓' };

function elapsed(placedAt) {
  const ms = Date.now() - new Date(placedAt).getTime();
  const min = Math.max(0, Math.floor(ms / 60000));
  if (min < 1) return 'just now';
  if (min === 1) return '1 min ago';
  if (min < 60) return `${min} min ago`;
  return `${Math.floor(min / 60)}h ${min % 60}m ago`;
}

function elapsedMin(placedAt) {
  return Math.max(0, (Date.now() - new Date(placedAt).getTime()) / 60000);
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

function OrderCard({ order, onAction, acting, compact }) {
  const mins = elapsedMin(order.placedAt);
  const level = urgency(mins);
  const meta = URGENCY[level];
  const action = NEXT_ACTION[order.status];
  return (
    <Card
      variant="outlined"
      sx={{
        // Literal px radius — numeric values multiply theme.shape and go oval.
        borderRadius: '14px',
        overflow: 'hidden',
        opacity: acting ? 0.6 : 1,
        ...(level !== 'fresh' && { borderLeft: 4, borderLeftColor: level === 'late' ? 'error.main' : 'warning.main' }),
      }}
    >
      {/* Urgency strip — amber at 5m, red at 10m, any live state */}
      {meta.label && (
        <Box sx={{ px: 1.5, py: 0.4, bgcolor: level === 'late' ? 'error.main' : 'warning.main', color: '#fff' }}>
          <Typography variant="caption" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10 }}>
            {meta.label} · {elapsed(order.placedAt)}
          </Typography>
        </Box>
      )}
      <CardContent sx={{ p: compact ? 1 : 1.5, '&:last-child': { pb: compact ? 1 : 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: compact ? 0.5 : 0.75 }}>
          <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.01em', lineHeight: 1, fontSize: compact ? 22 : 28 }}>
            {order.tableNumber}
          </Typography>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            {order.orderNumber}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Typography
            variant="body2"
            fontWeight={700}
            color={meta.color}
            sx={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {elapsed(order.placedAt)}
          </Typography>
        </Box>
        <Box sx={{ display: 'grid', gap: compact ? 0.25 : 0.5, mb: 1 }}>
          {(order.items ?? []).map((it, idx) => (
            <Box key={idx}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <Typography variant="body1" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums', minWidth: 34 }}>
                  ×{it.quantity}
                </Typography>
                <Typography variant="body2" fontWeight={700} sx={{ flexGrow: 1 }}>
                  {it.menuItemName}
                </Typography>
              </Box>
              {(it.modifiers ?? []).length > 0 && (
                <Typography variant="caption" color="primary.main" fontWeight={600} sx={{ ml: 5, display: 'block' }}>
                  {(it.modifiers ?? []).map((m) => m.modifierName).join(', ')}
                </Typography>
              )}
              {it.specialInstructions && (
                <Box sx={{ ml: 5, mt: 0.25, px: 1, py: 0.5, borderRadius: 1.5, bgcolor: (theme) => alpha(theme.palette.warning.main, 0.14), borderLeft: 3, borderColor: 'warning.main' }}>
                  <Typography variant="caption" fontWeight={700}>
                    “{it.specialInstructions}”
                  </Typography>
                </Box>
              )}
            </Box>
          ))}
        </Box>
        {order.specialInstructions && (
          <Box sx={{ mb: 1, px: 1, py: 0.5, borderRadius: 1.5, bgcolor: (theme) => alpha(theme.palette.warning.main, 0.14), borderLeft: 3, borderColor: 'warning.main' }}>
            <Typography variant="caption" fontWeight={700}>
              Order note: “{order.specialInstructions}”
            </Typography>
          </Box>
        )}
        {action && (
          <Button
            fullWidth
            variant={order.status === 'PLACED' ? 'contained' : 'outlined'}
            disabled={acting}
            onClick={() => onAction(order, action)}
            sx={{ borderRadius: 2.5, minHeight: compact ? 40 : 48, fontWeight: 800 }}
          >
            {acting ? 'Updating…' : ACTION_LABEL[action]}
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actingId, setActingId] = useState(null);
  const [sound, setSound] = useState(true);
  const [mobileTab, setMobileTab] = useState('NEW');
  const [ticketQuery, setTicketQuery] = useState('');
  const [compact, setCompact] = useState(false);
  const [tick, setTick] = useState(0);
  // 86-board: kitchen-owned availability toggles (Phase 5b). Loaded lazily per restaurant.
  const [availOpen, setAvailOpen] = useState(false);
  const [availItems, setAvailItems] = useState(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availQuery, setAvailQuery] = useState('');
  const [availMsg, setAvailMsg] = useState(null);
  const knownIds = useRef(new Set());

  // Fix 2: branch-scoped kitchen staff locked to home branch.
  useEffect(() => {
    if (user?.branchId && branchId !== user.branchId) {
      setBranchId(user.branchId);
      localStorage.setItem(BRANCH_KEY, user.branchId);
    }
  }, [user, branchId]);

  // Restaurants on mount
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

  // Branches when restaurant changes
  useEffect(() => {
    if (!restaurantId) {
      setBranches([]);
      return;
    }
    listBranches(restaurantId)
      .then((r) => {
        setBranches(r.data ?? []);
        // Keep saved branch if it belongs here, else pick first.
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
      // Rush-hour poll: live tickets only (server filters + sorts oldest-first).
      const res = await searchOrders({ branchId, liveOnly: true });
      const list = res.data ?? [];
      // Chime on genuinely new PLACED orders (not on first load).
      if (sound && knownIds.current.size > 0) {
        const fresh = list.filter((o) => o.status === 'PLACED' && !knownIds.current.has(o.id));
        if (fresh.length > 0) chime();
      }
      knownIds.current = new Set(list.map((o) => o.id));
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

  // Re-render timers every 30s without refetching.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  async function handleAction(order, action) {
    setActingId(order.id);
    try {
      await updateOrderStatus(order.id, action);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActingId(null);
    }
  }

  async function loadAvail() {
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
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setAvailLoading(false);
    }
  }

  function onAvailToggle() {
    if (!availOpen && availItems === null) loadAvail();
    setAvailOpen((o) => !o);
  }

  async function toggleAvail(item) {
    try {
      const res = await setAvailability(item.id, !item.available);
      const row = res.data ?? { ...item, available: !item.available };
      setAvailItems((list) => (list ?? []).map((i) => (i.id === item.id ? { ...i, ...row } : i)));
      setAvailMsg(`${item.name} marked ${row.available ? 'available ✓' : 'sold out ✓'}`);
      setTimeout(() => setAvailMsg(null), 3000);
    } catch (e) {
      setError(e.message);
    }
  }

  const grouped = useMemo(() => {
    const map = { NEW: [], PREP: [], READY: [] };
    const q = ticketQuery.trim().toLowerCase();
    for (const o of orders) {
      // Rush search: table number or order number (e.g. "T12", "1042").
      if (q && !`${o.tableNumber ?? ''} ${o.orderNumber ?? ''}`.toLowerCase().includes(q)) continue;
      if (o.status === 'PLACED') map.NEW.push(o);
      else if (o.status === 'ACCEPTED' || o.status === 'PREPARING') map.PREP.push(o);
      else if (o.status === 'READY') map.READY.push(o);
    }
    // Oldest first within each column — longest-waiting ticket on top.
    // (Server already sorts; this keeps it true after local filtering.)
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => new Date(a.placedAt) - new Date(b.placedAt));
    }
    return map;
  }, [orders, tick, ticketQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCount = orders.filter((o) => ['PLACED', 'ACCEPTED', 'PREPARING', 'READY'].includes(o.status)).length;
  const oldestMs = orders.length > 0
    ? Math.max(...orders.map((o) => Date.now() - new Date(o.placedAt).getTime()))
    : 0;
  const oldestLabel = orders.length > 0 ? elapsed(new Date(Date.now() - oldestMs).toISOString()) : null;

  return (
    <Box>
      <PageHeader
        title="Kitchen Display"
        subtitle={
          activeCount > 0
            ? `${activeCount} live order${activeCount === 1 ? '' : 's'}${oldestLabel ? ` · oldest ${oldestLabel}` : ''} · refreshes every 7s`
            : 'No live orders · refreshes every 7s'
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
            <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={() => { setLoading(true); load(); }}>
              Refresh
            </Button>
          </Box>
        }
      />
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        {user?.branchId ? (
          <Alert severity="info" sx={{ flexGrow: 1 }}>
            Locked to your branch — {user.branchName ? `${user.restaurantName ?? ''} · ${user.branchName}` : 'home kitchen'}. Contact your owner to move branches.
          </Alert>
        ) : (
          <>
            <FormControl size="small" sx={{ minWidth: 200, flexGrow: 1 }}>
              <InputLabel>Restaurant</InputLabel>
              <Select value={restaurantId} label="Restaurant" onChange={(e) => setRestaurantId(e.target.value)}>
                {restaurants.map((r) => (
                  <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
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
                  <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </>
        )}
      </Paper>

      {branchId && (
        <Paper variant="outlined" sx={{ borderRadius: 3, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={800} sx={{ flexGrow: 1, letterSpacing: '-0.01em' }}>
              86-board · menu availability
            </Typography>
            {availItems !== null && (
              <Chip
                size="small"
                label={`${availItems.filter((i) => !i.available).length} sold out`}
                color={availItems.some((i) => !i.available) ? 'warning' : 'default'}
              />
            )}
            <Button size="small" variant="outlined" onClick={onAvailToggle}>
              {availOpen ? 'Hide' : 'Manage'}
            </Button>
            <Button size="small" variant="text" onClick={loadAvail} disabled={!availOpen || availLoading}>
              Refresh
            </Button>
          </Box>
          <Collapse in={availOpen}>
            <Box sx={{ px: 1.5, pb: 1.5 }}>
              {availMsg && <Alert severity="success" sx={{ mb: 1 }}>{availMsg}</Alert>}
              <TextField
                size="small"
                fullWidth
                placeholder="Search items…"
                value={availQuery}
                onChange={(e) => setAvailQuery(e.target.value)}
                sx={{ mb: 1 }}
              />
              {availLoading && availItems === null ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                <Box sx={{ display: 'grid', gap: 0.75, maxHeight: 320, overflowY: 'auto' }}>
                  {(availItems ?? [])
                    .filter((i) => i.name.toLowerCase().includes(availQuery.trim().toLowerCase()))
                    .map((i) => (
                      <Box
                        key={i.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          p: 1,
                          borderRadius: 2,
                          border: 1,
                          borderColor: 'divider',
                          opacity: i.available ? 1 : 0.65,
                        }}
                      >
                        <Switch
                          size="small"
                          checked={!!i.available}
                          onChange={() => toggleAvail(i)}
                          slotProps={{ input: { 'aria-label': `availability of ${i.name}` } }}
                        />
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={700} noWrap>
                            {i.name}
                          </Typography>
                          <Typography variant="caption" color={!i.available ? 'warning.main' : 'text.secondary'} fontWeight={!i.available ? 700 : 400}>
                            {!i.available && 'Sold out · '}{i.categoryName}
                            {i.lastChangedBy && ` · by ${i.lastChangedBy}`}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  {availItems !== null && availItems.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                      No items in this restaurant yet.
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          </Collapse>
        </Paper>
      )}

      {!branchId ? (
        <Alert severity="info">Pick a restaurant + branch to see its live orders. Log in as kitchen staff, manager or owner.</Alert>
      ) : loading && orders.length === 0 ? (
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' } }}>
          {[0, 1, 2].map((i) => (
            <Box key={i}>
              <Skeleton variant="rounded" height={52} sx={{ mb: 1 }} />
              <Skeleton variant="rounded" height={220} sx={{ mb: 1.25 }} />
              <Skeleton variant="rounded" height={160} />
            </Box>
          ))}
        </Box>
      ) : (
        <>
          {/* Phone: tab switcher. Tablet/desktop: 3 columns side by side. */}
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search table or order — T12, 1042…"
              value={ticketQuery}
              onChange={(e) => setTicketQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                sx: { borderRadius: 3, bgcolor: 'background.paper' },
              }}
              sx={{ flexGrow: 1 }}
            />
            <ToggleButtonGroup
              size="small"
              exclusive
              value={compact ? 'COMPACT' : 'COMFY'}
              onChange={(_, v) => v && setCompact(v === 'COMPACT')}
              aria-label="ticket density"
              sx={{ flexShrink: 0 }}
            >
              <ToggleButton value="COMFY">Comfy</ToggleButton>
              <ToggleButton value="COMPACT">Compact</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 1.5 }}>
            <ToggleButtonGroup
              fullWidth
              size="small"
              exclusive
              value={mobileTab}
              onChange={(_, v) => v && setMobileTab(v)}
            >
              {COLUMNS.map((c) => (
                <ToggleButton key={c.key} value={c.key}>
                  {c.title} ({grouped[c.key].length})
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
              alignItems: 'start',
            }}
          >
            {COLUMNS.map((col) => (
              <Box
                key={col.key}
                sx={{ display: { xs: mobileTab === col.key ? 'block' : 'none', md: 'block' } }}
              >
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.25, borderRadius: '14px', mb: 1,
                    bgcolor: (theme) => alpha(theme.palette[col.color].main, 0.1),
                    display: 'flex', alignItems: 'center', gap: 1,
                  }}
                >
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: `${col.color}.main`, flexShrink: 0 }} />
                  <Typography
                    variant="subtitle2"
                    fontWeight={800}
                    sx={{ flexGrow: 1, textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: 12 }}
                  >
                    {col.title}
                  </Typography>
                  {(() => {
                    const list = grouped[col.key];
                    const oldest = list.length > 0
                      ? elapsed(list.reduce((a, b) => (new Date(a.placedAt) < new Date(b.placedAt) ? a : b)).placedAt)
                      : null;
                    return (
                      <>
                        {oldest && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            oldest {oldest}
                          </Typography>
                        )}
                        <Chip size="small" label={list.length} color={col.color} />
                      </>
                    );
                  })()}
                </Paper>
                <Box sx={{ display: 'grid', gap: 1.25 }}>
                  {grouped[col.key].length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                      All clear
                    </Typography>
                  )}
                  {grouped[col.key].map((o) => (
                    <OrderCard key={o.id} order={o} onAction={handleAction} acting={actingId === o.id} compact={compact} />
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
            Board refreshes every 7s · served orders leave automatically
          </Typography>
        </>
      )}
    </Box>
  );
}
