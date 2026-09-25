import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Skeleton,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { GuestHeader, Sym } from '../../components/guest/GuestChrome.jsx';
import CustomerLayout from '../../components/layout/CustomerLayout.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import VegMark from '../../components/VegMark.jsx';
import { useSession } from '../../hooks/useSession.js';
import { cancelOrder, getOrder, getPublicMenu, listSessionOrders } from '../../services/ordering.js';

// 4 guest-facing stages: ACCEPTED + PREPARING fold into Cooking.
const STAGES = [
  { key: 'PLACED', label: 'Placed', icon: 'check' },
  { key: 'COOKING', label: 'Cooking', icon: 'skillet' },
  { key: 'READY', label: 'Ready', icon: 'room_service' },
  { key: 'SERVED', label: 'Served', icon: 'done_all' },
];
const TERMINAL_BAD = ['CANCELLED', 'REJECTED'];

function stageOf(status) {
  if (status === 'PLACED') return 0;
  if (status === 'ACCEPTED' || status === 'PREPARING') return 1;
  if (status === 'READY') return 2;
  if (status === 'SERVED') return 3;
  return 0;
}

function StatusTracker({ status }) {
  if (TERMINAL_BAD.includes(status)) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        Order {status.toLowerCase()} — {status === 'CANCELLED' ? 'ask the waiter if you need help.' : 'kitchen could not accept it.'}
      </Alert>
    );
  }
  const idx = stageOf(status);
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
        {STAGES.map((s, i) => (
          <Box key={s.key} sx={{ flexGrow: 1, textAlign: 'center', position: 'relative' }}>
            {i > 0 && (
              <Box sx={{
                position: 'absolute', top: 16, right: '50%', width: '100%', height: 4,
                bgcolor: i <= idx ? '#00632B' : '#EEE7E3', zIndex: 0,
              }} />
            )}
            <Avatar
              sx={{
                width: 32, height: 32, mx: 'auto', mb: 0.5, position: 'relative', zIndex: 1,
                bgcolor: i < idx ? '#00632B' : i === idx ? '#C2410C' : '#EEE7E3',
                color: i <= idx ? '#fff' : '#8D7168',
                ...(i === idx && status !== 'SERVED' ? { animation: 'tpbounce 2s infinite', '@keyframes tpbounce': { '50%': { transform: 'scale(1.08)' } } } : {}),
              }}
            >
              <Sym name={i < idx ? 'check' : s.icon} size={18} />
            </Avatar>
            <Typography variant="caption" fontWeight={i <= idx ? 800 : 400}
              color={i <= idx ? (i === idx ? '#9B2F00' : '#00632B') : 'text.secondary'}
              sx={{ fontSize: 10 }}>
              {s.label}
            </Typography>
          </Box>
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
        Live · auto-refreshes every few seconds
      </Typography>
    </Box>
  );
}

function OrderDetailCard({ order, cancelling, onCancel, vegOf }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={800} sx={{ flexGrow: 1, letterSpacing: '-0.01em' }}>
          {order?.orderNumber}
        </Typography>
        <Chip
          size="small"
          label={order?.status}
          color={order?.status === 'READY' ? 'success' : order?.status === 'SERVED' ? 'default' : 'primary'}
        />
      </Box>
      <StatusTracker status={order?.status} />
      <Divider sx={{ my: 1.5 }} />
      {(order?.items ?? []).map((it, i) => {
        const veg = vegOf ? vegOf(it.menuItemName) : null;
        return (
          <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, py: 0.5 }}>
            <Box sx={{ minWidth: 0, display: 'flex', gap: 1 }}>
              {veg !== null && (
                <Box sx={{ pt: 0.25, flexShrink: 0 }}>
                  <VegMark veg={veg} size={12} />
                </Box>
              )}
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={700}>
                  {it.menuItemName} × {it.quantity}
                </Typography>
                {(it.modifiers ?? []).length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {(it.modifiers ?? []).map((m) => m.modifierName).join(', ')}
                  </Typography>
                )}
                {it.specialInstructions && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    “{it.specialInstructions}”
                  </Typography>
                )}
              </Box>
            </Box>
            <Typography variant="body2" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
              ₹{Number(it.totalPrice).toFixed(2)}
            </Typography>
          </Box>
        );
      })}
      <Divider sx={{ my: 1.5 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Typography variant="body2" color="text.secondary">Subtotal + GST</Typography>
        <Typography variant="h6" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>
          ₹{Number(order?.totalAmount ?? 0).toFixed(2)}
        </Typography>
      </Box>
      {order?.status === 'PLACED' && (
        <Button color="error" size="small" sx={{ mt: 1, fontWeight: 600 }} disabled={cancelling} onClick={onCancel}>
          {cancelling ? 'Cancelling…' : 'Cancel this order'}
        </Button>
      )}
    </Paper>
  );
}

export default function OrderTracker() {
  const { slug, table, orderId } = useParams();
  const [searchParams] = useSearchParams();
  const branchId = searchParams.get('b');
  const navigate = useNavigate();
  // History view: keep resolving against the (possibly closed) session
  // so old tracker/receipt links survive after the waiter closes the table.
  const { token, loading: sessionLoading, error: sessionError } = useSession(slug, table, branchId, { reuseClosed: true });

  const [order, setOrder] = useState(null);
  const [others, setOthers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [restName, setRestName] = useState(null);
  const [prepByName, setPrepByName] = useState({});

  const withBranch = (path) => (branchId ? `${path}?b=${encodeURIComponent(branchId)}` : path);
  const base = `/r/${slug}/t/${table}`;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [o, list] = await Promise.all([
        getOrder(orderId, token),
        listSessionOrders(token).catch(() => ({ data: [] })),
      ]);
      setOrder(o.data);
      setOthers((list.data ?? []).filter((x) => x.id !== orderId));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, orderId]);

  useEffect(() => {
    if (!token) return;
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [token, load]);

  // Best-effort menu join: outlet name + per-dish prep/veg for the tracker.
  useEffect(() => {
    let alive = true;
    getPublicMenu(slug)
      .then((res) => {
        if (!alive) return;
        setRestName(res.data?.restaurant?.name ?? null);
        const map = {};
        for (const c of res.data?.categories ?? []) {
          for (const i of c.items ?? []) {
            if (i?.name) map[i.name] = { veg: i.vegetarian, prep: i.preparationTimeMinutes };
          }
        }
        setPrepByName(map);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [slug]);

  async function handleCancel(id) {
    if (!token || cancellingId || !id) return;
    setCancellingId(id);
    try {
      const res = await cancelOrder(id, token, 'Cancelled by customer');
      if (res.data) {
        if (res.data.id === orderId) setOrder(res.data);
        setOthers((prev) => prev.map((o) => (o.id === id ? res.data : o)));
      } else {
        await load();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setCancellingId(null);
    }
  }

  if (sessionLoading || (loading && !order)) {
    return (
      <CustomerLayout title="Tracking your order…" subtitle="Talking to the kitchen">
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Skeleton variant="text" width="40%" height={30} sx={{ mb: 1 }} />
          <Skeleton variant="rounded" height={64} sx={{ mb: 1.5 }} />
          <Skeleton variant="text" width="80%" height={22} />
          <Skeleton variant="text" width="65%" height={22} />
          <Skeleton variant="text" width="45%" height={28} sx={{ mt: 1 }} />
        </Paper>
      </CustomerLayout>
    );
  }

  if (sessionError || (error && !order)) {
    return (
      <CustomerLayout title="Order not found">
        <EmptyState icon="⚠️" title="Couldn't load order" body={sessionError ?? error}
          actionLabel="Back to menu" onAction={() => navigate(withBranch(base))} />
      </CustomerLayout>
    );
  }

  const vegOf = (name) => {
    const hit = prepByName[name];
    return hit && typeof hit.veg === 'boolean' ? hit.veg : null;
  };
  const itemCount = (order?.items ?? []).reduce((n, it) => n + Number(it.quantity ?? 0), 0);
  const placedAt = order?.placedAt ? new Date(order.placedAt) : null;
  const estPrep = (() => {
    const pres = (order?.items ?? [])
      .map((it) => Number(prepByName[it.menuItemName]?.prep ?? 0))
      .filter((n) => n > 0);
    return pres.length > 0 ? Math.max(...pres) : null;
  })();

  return (
    <CustomerLayout>
      <GuestHeader restaurantName={restName ?? '…'} tableLabel={`Table ${table}`} />
      <Box sx={{ height: 80 }} />
      {error && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError(null)}>
          Refresh issue: {error}
        </Alert>
      )}

      {/* live session banner */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2, position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#00632B' }} />
            <Typography variant="body2" fontWeight={800} fontSize={12} sx={{ letterSpacing: '.06em', color: '#00632B' }}>
              LIVE DINING SESSION
            </Typography>
          </Box>
          <Chip size="small" label={`Table ${table}`} sx={{ fontSize: 10, fontWeight: 800 }} />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="h5" fontWeight={800} fontSize={22}>
              Order {order?.orderNumber ?? ''}
            </Typography>
            <Typography variant="body2" fontSize={12} color="text.secondary">
              Placed {placedAt ? placedAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '…'} · Total {itemCount} item{itemCount === 1 ? '' : 's'}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" fontSize={10} color="text.secondary" sx={{ textTransform: 'uppercase', display: 'block' }}>
              Est. Savor Time
            </Typography>
            <Typography variant="h6" fontWeight={800} fontSize={18} sx={{ color: '#9B2F00' }}>
              {estPrep != null ? `~${estPrep} mins` : 'Firing…'}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: '#FAF2EE', display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Avatar sx={{ bgcolor: '#C2410C', width: 40, height: 40 }}>
            <Sym name="person_apron" size={20} />
          </Avatar>
          <Typography variant="body2" fontSize={12} color="text.secondary">
            <strong style={{ color: '#1E1B19' }}>Kitchen is on it</strong> — your dishes move through the pass live below.
          </Typography>
        </Box>
      </Paper>

      <OrderDetailCard
        order={order}
        cancelling={cancellingId === order?.id}
        onCancel={() => handleCancel(order?.id)}
        vegOf={vegOf}
      />

      {others.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={800} gutterBottom>
            Other orders at this table ({others.length})
          </Typography>
          {others.map((o) => (
            <Accordion
              key={o.id}
              expanded={expandedId === o.id}
              onChange={(_, isOpen) => setExpandedId(isOpen ? o.id : null)}
              disableGutters
              elevation={0}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0, minHeight: 48 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', pr: 1 }}>
                  <Typography variant="body2" fontWeight={600}>{o.orderNumber} · {o.status}</Typography>
                  <Typography variant="body2" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    ₹{Number(o.totalAmount).toFixed(2)}
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 0, pb: 0 }}>
                <OrderDetailCard
                  order={o}
                  cancelling={cancellingId === o.id}
                  onCancel={() => handleCancel(o.id)}
                  vegOf={vegOf}
                />
              </AccordionDetails>
            </Accordion>
          ))}
        </Paper>
      )}

      <Button
        fullWidth
        variant="outlined"
        startIcon={<Sym name="add_circle" size={18} />}
        onClick={() => navigate(withBranch(base))}
        sx={{ borderRadius: 2, fontWeight: 800, height: 48, mb: 1.5 }}
      >
        Add More Starters, Breads or Drinks
      </Button>
      <Box sx={{ display: 'flex', gap: 1, pb: 2 }}>
        <Button variant="text" fullWidth onClick={() => navigate(withBranch(base))} sx={{ fontWeight: 700 }}>
          Order More
        </Button>
        <Button variant="contained" fullWidth onClick={() => navigate(withBranch(`${base}/bill`))} sx={{ fontWeight: 800 }}>
          View Bill
        </Button>
      </Box>
    </CustomerLayout>
  );
}
