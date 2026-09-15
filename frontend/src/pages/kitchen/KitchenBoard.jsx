import RefreshIcon from '@mui/icons-material/Refresh';
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
  Collapse,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../../components/layout/PageHeader.jsx';
import { searchOrders, updateOrderStatus } from '../../services/kitchen.js';
import { listCategories, listItems, setAvailability } from '../../services/menu.js';
import { listBranches, listRestaurants } from '../../services/restaurant.js';

const BRANCH_KEY = 'tp_kds_branch';
const POLL_MS = 7000;

const COLUMNS = [
  { key: 'NEW', title: '📥 New', statuses: ['PLACED'], color: 'warning' },
  { key: 'PREP', title: '🔥 Preparing', statuses: ['ACCEPTED', 'PREPARING'], color: 'info' },
  { key: 'READY', title: '✅ Ready', statuses: ['READY'], color: 'success' },
];

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

function OrderCard({ order, onAction, acting }) {
  const mins = elapsedMin(order.placedAt);
  const urgent = order.status === 'PLACED' && mins >= 10;
  const action = NEXT_ACTION[order.status];
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 3,
        borderLeft: 4,
        borderLeftColor: urgent ? 'error.main' : 'primary.main',
        opacity: acting ? 0.6 : 1,
      }}
    >
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="subtitle1" fontWeight={800}>
            {order.orderNumber}
          </Typography>
          <Chip size="small" label={`Table ${order.tableNumber}`} color="primary" variant="outlined" />
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="caption" color={urgent ? 'error.main' : 'text.secondary'} fontWeight={urgent ? 800 : 400}>
            ⏱ {elapsed(order.placedAt)}
          </Typography>
        </Box>
        {urgent && <Alert severity="error" sx={{ mb: 1, py: 0 }}>Waiting 10+ min — prioritize!</Alert>}
        <Box sx={{ display: 'grid', gap: 0.25, mb: 1 }}>
          {(order.items ?? []).map((it, idx) => (
            <Box key={idx}>
              <Typography variant="body2" fontWeight={700}>
                • {it.menuItemName} × {it.quantity}
              </Typography>
              {(it.modifiers ?? []).length > 0 && (
                <Typography variant="caption" color="primary.main" sx={{ ml: 2, display: 'block' }}>
                  {(it.modifiers ?? []).map((m) => m.modifierName).join(', ')}
                </Typography>
              )}
              {it.specialInstructions && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 2, display: 'block', fontStyle: 'italic' }}>
                  “{it.specialInstructions}”
                </Typography>
              )}
            </Box>
          ))}
        </Box>
        {order.specialInstructions && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Note: “{order.specialInstructions}”
          </Typography>
        )}
        {action && (
          <Button
            fullWidth
            size="small"
            variant={order.status === 'PLACED' ? 'contained' : 'outlined'}
            disabled={acting}
            onClick={() => onAction(order, action)}
            sx={{ borderRadius: 2 }}
          >
            {acting ? 'Updating…' : ACTION_LABEL[action]}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function KitchenBoard() {
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
  const [tick, setTick] = useState(0);
  // 86-board: kitchen-owned availability toggles (Phase 5b). Loaded lazily per restaurant.
  const [availOpen, setAvailOpen] = useState(false);
  const [availItems, setAvailItems] = useState(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availQuery, setAvailQuery] = useState('');
  const [availMsg, setAvailMsg] = useState(null);
  const knownIds = useRef(new Set());

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
      const res = await searchOrders({ branchId });
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
    for (const o of orders) {
      if (o.status === 'PLACED') map.NEW.push(o);
      else if (o.status === 'ACCEPTED' || o.status === 'PREPARING') map.PREP.push(o);
      else if (o.status === 'READY') map.READY.push(o);
    }
    return map;
  }, [orders, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCount = orders.filter((o) => ['PLACED', 'ACCEPTED', 'PREPARING', 'READY'].includes(o.status)).length;

  return (
    <Box>
      <PageHeader
        title="🔔 Kitchen Display"
        subtitle={activeCount > 0 ? `${activeCount} live order${activeCount === 1 ? '' : 's'} · auto-refresh every 7s` : 'No live orders · auto-refresh every 7s'}
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
      </Paper>

      {branchId && (
        <Paper variant="outlined" sx={{ borderRadius: 3, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={800} sx={{ flexGrow: 1 }}>
              🔴 Menu availability (86-board)
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
                            {!i.available && '🔴 '}{i.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {i.categoryName}
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
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Phone: tab switcher. Tablet/desktop: 3 columns side by side. */}
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
                  sx={{ p: 1.25, borderRadius: 3, mb: 1, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <Typography variant="subtitle1" fontWeight={800} sx={{ flexGrow: 1 }}>
                    {col.title}
                  </Typography>
                  <Chip size="small" label={grouped[col.key].length} color={col.color} />
                </Paper>
                <Box sx={{ display: 'grid', gap: 1.25 }}>
                  {grouped[col.key].length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                      Nothing here
                    </Typography>
                  )}
                  {grouped[col.key].map((o) => (
                    <OrderCard key={o.id} order={o} onAction={handleAction} acting={actingId === o.id} />
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
            Served / cancelled orders leave the board · customer phone updates on its 5s refresh (live sockets land later)
          </Typography>
        </>
      )}
    </Box>
  );
}
