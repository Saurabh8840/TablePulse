import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import CustomerLayout from '../../components/layout/CustomerLayout.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { useSession } from '../../hooks/useSession.js';
import { cancelOrder, getOrder, listSessionOrders } from '../../services/ordering.js';

const FLOW = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED'];
const FLOW_LABEL = { PLACED: 'Placed', ACCEPTED: 'Accepted', PREPARING: 'Preparing', READY: 'Ready', SERVED: 'Served' };
const TERMINAL_BAD = ['CANCELLED', 'REJECTED'];

function StatusTracker({ status }) {
  if (TERMINAL_BAD.includes(status)) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        Order {status.toLowerCase()} — {status === 'CANCELLED' ? 'ask the waiter if you need help.' : 'kitchen could not accept it.'}
      </Alert>
    );
  }
  const idx = FLOW.indexOf(status);
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
        {FLOW.map((s, i) => (
          <Box key={s} sx={{ flexGrow: 1, textAlign: 'center', position: 'relative' }}>
            {i > 0 && (
              <Box sx={{
                position: 'absolute', top: 9, right: '50%', width: '100%', height: 2,
                bgcolor: i <= idx ? 'primary.main' : 'divider', zIndex: 0,
              }} />
            )}
            <Box
              sx={{
                width: 20, height: 20, borderRadius: '50%', mx: 'auto', mb: 0.5, position: 'relative', zIndex: 1,
                bgcolor: i <= idx ? 'primary.main' : 'background.paper',
                border: 2, borderColor: i <= idx ? 'primary.dark' : 'divider',
                color: '#fff', fontSize: 11, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {i < idx ? '✓' : i === idx ? '●' : ''}
            </Box>
            <Typography variant="caption" fontWeight={i <= idx ? 800 : 400}
              color={i <= idx ? 'text.primary' : 'text.secondary'}
              sx={{ fontSize: { xs: 10, sm: 11 } }}>
              {FLOW_LABEL[s]}
            </Typography>
          </Box>
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
        Live · auto-refreshes every 5s (realtime socket lands in Phase 4)
      </Typography>
    </Box>
  );
}

export default function OrderTracker() {
  const { slug, table, orderId } = useParams();
  const [searchParams] = useSearchParams();
  const branchId = searchParams.get('b');
  const navigate = useNavigate();
  const { token, loading: sessionLoading, error: sessionError } = useSession(slug, table, branchId);

  const [order, setOrder] = useState(null);
  const [others, setOthers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);

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

  async function handleCancel() {
    if (!token || cancelling) return;
    setCancelling(true);
    try {
      const res = await cancelOrder(orderId, token, 'Cancelled by customer');
      setOrder(res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setCancelling(false);
    }
  }

  if (sessionLoading || (loading && !order)) {
    return (
      <CustomerLayout title="Tracking your order…" subtitle="Talking to the kitchen">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
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

  return (
    <CustomerLayout title="Order Placed ✅" subtitle={`Table ${table} · ${order?.orderNumber ?? ''}`}>
      {error && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError(null)}>
          Refresh issue: {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1.5 }}>
          <Typography variant="h6" fontWeight={800} sx={{ flexGrow: 1 }}>
            {order?.orderNumber}
          </Typography>
          <Chip label={order?.status} color={order?.status === 'READY' ? 'success' : 'primary'} />
        </Box>
        <StatusTracker status={order?.status} />
        <Divider sx={{ my: 1.5 }} />
        {(order?.items ?? []).map((it, i) => (
          <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.5 }}>
            <Box>
              <Typography variant="body2" fontWeight={700}>
                {it.menuItemName} × {it.quantity}
              </Typography>
              {(it.modifiers ?? []).length > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {(it.modifiers ?? []).map((m) => m.modifierName).join(', ')}
                </Typography>
              )}
              {it.specialInstructions && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  “{it.specialInstructions}”
                </Typography>
              )}
            </Box>
            <Typography variant="body2">₹{Number(it.totalPrice).toFixed(2)}</Typography>
          </Box>
        ))}
        <Divider sx={{ my: 1.5 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">Subtotal + GST</Typography>
          <Typography variant="subtitle1" fontWeight={800}>₹{Number(order?.totalAmount ?? 0).toFixed(2)}</Typography>
        </Box>
        {order?.status === 'PLACED' && (
          <Button color="error" size="small" sx={{ mt: 1 }} disabled={cancelling} onClick={handleCancel}>
            {cancelling ? 'Cancelling…' : 'Cancel this order'}
          </Button>
        )}
      </Paper>

      {others.length > 0 && (
        <Card variant="outlined" sx={{ borderRadius: 3, mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={800} gutterBottom>
              Other orders at this table ({others.length})
            </Typography>
            {others.map((o) => (
              <Box key={o.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                <Typography variant="body2">{o.orderNumber} · {o.status}</Typography>
                <Typography variant="body2">₹{Number(o.totalAmount).toFixed(2)}</Typography>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button variant="outlined" fullWidth onClick={() => navigate(withBranch(base))}>
          Order More
        </Button>
        <Button variant="contained" fullWidth onClick={() => navigate(withBranch(`${base}/bill`))}>
          View Bill
        </Button>
      </Box>
    </CustomerLayout>
  );
}
