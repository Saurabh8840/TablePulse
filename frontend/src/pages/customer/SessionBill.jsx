import {
  Alert,
  Box,
  Button,
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
import { getBill, listSessionOrders } from '../../services/ordering.js';
import { confirmMockPayment, payAtCounter } from '../../services/payment.js';

export default function SessionBill() {
  const { slug, table } = useParams();
  const [searchParams] = useSearchParams();
  const branchId = searchParams.get('b');
  const navigate = useNavigate();
  const { token, loading: sessionLoading, error: sessionError } = useSession(slug, table, branchId);

  const [bill, setBill] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paying, setPaying] = useState(null);
  const [payError, setPayError] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [counterPending, setCounterPending] = useState(null);

  const withBranch = (path) => (branchId ? `${path}?b=${encodeURIComponent(branchId)}` : path);
  const base = `/r/${slug}/t/${table}`;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [b, list] = await Promise.all([getBill(token), listSessionOrders(token)]);
      setBill(b.data);
      setOrders(list.data ?? []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    load();
  }, [token, load]);

  if (sessionLoading || loading) {
    return (
      <CustomerLayout title="Preparing your bill…" subtitle={`Table ${table}`}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      </CustomerLayout>
    );
  }

  if (sessionError || (error && !bill)) {
    return (
      <CustomerLayout title="Bill unavailable">
        <EmptyState icon="🧾" title="Couldn't load bill" body={sessionError ?? error}
          actionLabel="Back to menu" onAction={() => navigate(withBranch(base))} />
      </CustomerLayout>
    );
  }

  if ((orders ?? []).length === 0) {
    return (
      <CustomerLayout title={`Table ${table} · Bill`} subtitle={slug}>
        <EmptyState icon="🧾" title="No orders yet" body="Your bill will appear here once you place your first order."
          actionLabel="Browse menu" onAction={() => navigate(withBranch(base))} />
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout title={`Table ${bill?.tableNumber ?? table} · Bill`} subtitle="Combined for this sitting">
      {error && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError(null)}>
          Refresh issue: {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 2 }}>
        {(bill?.orders ?? []).map((line, i) => (
          <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
            <Box>
              <Typography variant="body2" fontWeight={700}>{line.orderNumber}</Typography>
              <Typography variant="caption" color="text.secondary">{line.summary}</Typography>
            </Box>
            <Typography variant="body2">₹{Number(line.amount).toFixed(2)}</Typography>
          </Box>
        ))}
        <Divider sx={{ my: 1.5 }} />
        <Box sx={{ display: 'grid', gap: 0.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">Subtotal</Typography>
            <Typography variant="body2">₹{Number(bill?.subtotal ?? 0).toFixed(2)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">GST</Typography>
            <Typography variant="body2">₹{Number(bill?.taxAmount ?? 0).toFixed(2)}</Typography>
          </Box>
          {Number(bill?.serviceCharge ?? 0) > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Service charge</Typography>
              <Typography variant="body2">₹{Number(bill?.serviceCharge ?? 0).toFixed(2)}</Typography>
            </Box>
          )}
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="h6" fontWeight={800}>Total</Typography>
            <Typography variant="h6" fontWeight={800}>₹{Number(bill?.totalAmount ?? 0).toFixed(2)}</Typography>
          </Box>
        </Box>
      </Paper>

      {receipt ? (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 2, bgcolor: 'success.light' }}>
          <Typography variant="subtitle2" fontWeight={800} gutterBottom>
            Payment successful — Table closed
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {(bill?.orders ?? []).map((l) => l.orderNumber).join(' · ')} — ₹
            {Number(receipt.total ?? bill?.totalAmount ?? 0).toFixed(2)} paid via{' '}
            {receipt.method === 'MOCK_CARD' ? 'Mock Card' : 'Mock UPI'}.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Show this screen to your waiter. Receipt {String(receipt.id).slice(0, 8)}.
          </Typography>
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 2, bgcolor: 'action.hover' }}>
          <Typography variant="subtitle2" fontWeight={800} gutterBottom>
            Payment
          </Typography>
          {counterPending ? (
            <Alert severity="info" sx={{ mb: 1.5 }}>
              Pay at counter noted — please pay ₹
              {Number(counterPending.total ?? bill?.totalAmount ?? 0).toFixed(2)} at the counter
              showing this bill. Your waiter will close the table.
            </Alert>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Mock checkout for this pilot — no real money moves. Kitchen must serve all orders first.
            </Typography>
          )}
          {payError && (
            <Alert
              severity={/open order/i.test(payError) ? 'warning' : 'error'}
              sx={{ mb: 1.5 }}
              onClose={() => setPayError(null)}
              action={
                /open order/i.test(payError) ? (
                  <Button color="inherit" size="small" onClick={load}>
                    Refresh
                  </Button>
                ) : undefined
              }
            >
              {/open order/i.test(payError)
                ? `Kitchen still has open orders — ask for your food first. (${payError})`
                : payError}
            </Alert>
          )}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              fullWidth
              disabled={paying !== null || counterPending !== null}
              onClick={async () => {
                setPaying('mock');
                setPayError(null);
                try {
                  const res = await confirmMockPayment(token, 'MOCK_UPI');
                  setReceipt(res.data);
                } catch (e) {
                  setPayError(e.message);
                } finally {
                  setPaying(null);
                }
              }}
            >
              {paying === 'mock' ? 'Paying…' : 'Pay Now (Mock UPI)'}
            </Button>
            <Button
              variant="outlined"
              fullWidth
              disabled={paying !== null || counterPending !== null}
              onClick={async () => {
                setPaying('counter');
                setPayError(null);
                try {
                  const res = await payAtCounter(token);
                  if (res.data?.status === 'COMPLETED') setReceipt(res.data);
                  else setCounterPending(res.data);
                } catch (e) {
                  setPayError(e.message);
                } finally {
                  setPaying(null);
                }
              }}
            >
              {paying === 'counter' ? 'Noting…' : 'Pay at Counter'}
            </Button>
          </Box>
        </Paper>
      )}

      <Box sx={{ display: 'flex', gap: 1, position: 'sticky', bottom: 12 }}>
        <Button variant="outlined" fullWidth onClick={() => navigate(withBranch(base))} sx={{ bgcolor: 'background.paper' }}>
          Order More
        </Button>
        <Button variant="text" fullWidth onClick={load}>
          Refresh bill
        </Button>
      </Box>
    </CustomerLayout>
  );
}
