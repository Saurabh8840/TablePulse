import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
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
        Live · auto-refreshes every few seconds
      </Typography>
    </Box>
  );
}

function OrderDetailCard({ order, cancelling, onCancel }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 2 }}>
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
      {(order?.items ?? []).map((it, i) => (
        <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, py: 0.5 }}>
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
          <Typography variant="body2" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
            ₹{Number(it.totalPrice).toFixed(2)}
          </Typography>
        </Box>
      ))}
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
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
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

  return (
    <CustomerLayout title="Order placed" subtitle={`Table ${table} · ${order?.orderNumber ?? ''}`}>
      {error && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError(null)}>
          Refresh issue: {error}
        </Alert>
      )}

      <OrderDetailCard
        order={order}
        cancelling={cancellingId === order?.id}
        onCancel={() => handleCancel(order?.id)}
      />

      {others.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 2 }}>
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
                />
              </AccordionDetails>
            </Accordion>
          ))}
        </Paper>
      )}

      <Box sx={{ display: 'flex', gap: 1 }}>
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
