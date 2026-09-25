import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { GuestBottomNav, GuestHeader, Sym } from '../../components/guest/GuestChrome.jsx';
import CustomerLayout from '../../components/layout/CustomerLayout.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { useSession } from '../../hooks/useSession.js';
import { getBill, getPublicMenu, listSessionOrders } from '../../services/ordering.js';
import { confirmMockPayment, payAtCounter } from '../../services/payment.js';

export default function SessionBill() {
  const { slug, table } = useParams();
  const [searchParams] = useSearchParams();
  const branchId = searchParams.get('b');
  const navigate = useNavigate();
  const { token, waiterName, loading: sessionLoading, error: sessionError } = useSession(slug, table, branchId);

  const [bill, setBill] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paying, setPaying] = useState(null);
  const [payError, setPayError] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [counterPending, setCounterPending] = useState(null);
  const [payerName, setPayerName] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [restName, setRestName] = useState(null);
  const [diners, setDiners] = useState(2);
  const [toast, setToast] = useState(null);

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

  useEffect(() => {
    let alive = true;
    getPublicMenu(slug)
      .then((res) => {
        if (alive) setRestName(res.data?.restaurant?.name ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [slug]);

  if (sessionLoading || loading) {
    return (
      <CustomerLayout title="Preparing your bill…" subtitle={`Table ${table}`}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Skeleton variant="text" width="50%" height={24} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="90%" height={20} />
          <Skeleton variant="text" width="75%" height={20} />
          <Divider sx={{ my: 1.5 }} />
          <Skeleton variant="text" width="60%" height={20} />
          <Skeleton variant="text" width="60%" height={20} />
          <Skeleton variant="text" width="70%" height={32} sx={{ mt: 1 }} />
        </Paper>
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

  const paidTotal = Number(bill?.paidTotal ?? 0);
  const balanceDue = Number(bill?.balanceDue ?? bill?.totalAmount ?? 0);
  const paymentStatus = bill?.paymentStatus ?? 'UNPAID';
  const fullyPaid = paymentStatus === 'PAID';

  // Optional mobile: empty is fine, but anything typed must be a valid
  // 10-digit Indian mobile (same rule as the backend) or Pay stays blocked.
  const phoneDigits = payerPhone.replace(/\D/g, '');
  const phoneError =
    phoneDigits.length > 0 && !/^[6-9]\d{9}$/.test(phoneDigits)
      ? 'Enter a 10-digit mobile starting 6–9 (or clear it)'
      : '';

  const payerExtra = () => {
    const extra = {};
    if (payerName.trim()) extra.customerName = payerName.trim();
    if (!phoneError && phoneDigits) extra.customerPhone = phoneDigits;
    return extra;
  };

  const splitBase = balanceDue > 0 ? balanceDue : Number(bill?.totalAmount ?? 0);
  const perPerson = splitBase / Math.max(1, diners);
  const latestOrderId = [...(orders ?? [])].sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt))[0]?.id ?? null;

  return (
    <CustomerLayout>
      <GuestHeader restaurantName={restName ?? '…'} tableLabel={`Table ${bill?.tableNumber ?? table}`} />
      <Box sx={{ height: 80 }} />
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
        <Avatar sx={{ bgcolor: '#C2410C', width: 32, height: 32 }}>
          <Sym name="receipt" size={18} />
        </Avatar>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6" fontWeight={800} fontSize={18}>
            Current Bill
          </Typography>
          <Typography variant="caption" fontSize={10} color="text.secondary">
            Includes {(bill?.orders ?? []).length} order{(bill?.orders ?? []).length === 1 ? '' : 's'}{waiterName ? ` · Served by ${waiterName}` : ''}
          </Typography>
        </Box>
        {!fullyPaid && (
          <Chip size="small" label="Unsettled" sx={{ bgcolor: '#99EFE5', color: '#006A63', fontWeight: 800, fontSize: 10 }} />
        )}
      </Box>
      {error && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError(null)}>
          Refresh issue: {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        {(bill?.orders ?? []).map((line, i) => (
          <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, py: 0.5 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700}>{line.orderNumber}</Typography>
              <Typography variant="caption" color="text.secondary">{line.summary}</Typography>
            </Box>
            <Typography variant="body2" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
              ₹{Number(line.amount).toFixed(2)}
            </Typography>
          </Box>
        ))}
        <Divider sx={{ my: 1.5 }} />
        <Box sx={{ display: 'grid', gap: 0.5, fontVariantNumeric: 'tabular-nums' }}>
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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Typography variant="subtitle1" fontWeight={800}>Total</Typography>
            <Typography variant="h6" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>
              ₹{Number(bill?.totalAmount ?? 0).toFixed(2)}
            </Typography>
          </Box>
          {paidTotal > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="success.main" fontWeight={700}>
                Paid {paymentStatus === 'PARTIAL' ? '(partial)' : ''}
              </Typography>
              <Typography variant="body2" color="success.main" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                − ₹{paidTotal.toFixed(2)}
              </Typography>
            </Box>
          )}
          {!fullyPaid && paidTotal > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" fontWeight={800}>Balance due</Typography>
              <Typography variant="body2" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                ₹{balanceDue.toFixed(2)}
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>

      {!fullyPaid && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Sym name="group" size={20} />
              <Typography variant="body2" fontWeight={800} fontSize={14}>
                Split Bill with Diners
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                size="small"
                aria-label="Fewer diners"
                disabled={diners <= 1}
                onClick={() => setDiners((d) => Math.max(1, d - 1))}
                sx={{ minWidth: 28, height: 28, borderRadius: '50%', bgcolor: '#FAF2EE', color: '#1E1B19', fontWeight: 800 }}
              >
                −
              </Button>
              <Typography variant="body1" fontWeight={800} fontSize={16} sx={{ minWidth: 20, textAlign: 'center' }}>
                {diners}
              </Typography>
              <Button
                size="small"
                aria-label="More diners"
                disabled={diners >= 10}
                onClick={() => setDiners((d) => Math.min(10, d + 1))}
                sx={{ minWidth: 28, height: 28, borderRadius: '50%', bgcolor: '#FAF2EE', color: '#1E1B19', fontWeight: 800 }}
              >
                +
              </Button>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Typography variant="body2" fontSize={12} color="text.secondary">
              Each person pays:
            </Typography>
            <Typography variant="body1" fontWeight={800} fontSize={16} sx={{ color: '#9B2F00' }}>
              ₹{perPerson.toFixed(2)} / person
            </Typography>
          </Box>
        </Paper>
      )}

      {fullyPaid ? (
        <Paper
          variant="outlined"
          sx={{ p: 2, borderRadius: 2, mb: 2, borderLeft: 4, borderLeftColor: 'success.main' }}
        >
          <Typography variant="subtitle1" fontWeight={800} sx={{ letterSpacing: '-0.01em' }} gutterBottom>
            Paid in full — ₹{Number(bill?.totalAmount ?? 0).toFixed(2)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {(bill?.orders ?? []).map((l) => l.orderNumber).join(' · ')}
            {receipt ? ` — last receipt ${String(receipt.id).slice(0, 8)}.` : '.'}{' '}
            Your table stays open — order more if you like, or ask your waiter to close it.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Ordering more will add a new balance you can pay right here.
          </Typography>
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={800} sx={{ letterSpacing: '-0.01em' }} gutterBottom>
            Payment {paidTotal > 0 ? `(₹${balanceDue.toFixed(2)} remaining)` : ''}
          </Typography>
          {receipt && (
            <Alert severity="success" sx={{ mb: 1.5 }}>
              ₹{Number(receipt.total ?? 0).toFixed(2)} received
              {receipt.method === 'MOCK_CARD' ? ' via Mock Card' : receipt.method === 'MOCK_UPI' ? ' via Mock UPI' : ''}.
              Pay the remaining balance below — your table stays open.
            </Alert>
          )}
          {counterPending ? (
            <Alert severity="info" sx={{ mb: 1.5 }}>
              Pay at counter noted — please pay ₹
              {Number(counterPending.total ?? balanceDue).toFixed(2)} at the counter
              showing this bill. Your waiter will collect and close the table.
            </Alert>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Mock checkout for this pilot — no real money moves. Pay now or after your food arrives;
              the table closes only when your waiter closes it.
            </Typography>
          )}
          {payError && (
            <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setPayError(null)}>
              {payError}
            </Alert>
          )}
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
            <TextField
              size="small"
              fullWidth
              label="Name (optional)"
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
              inputProps={{ maxLength: 100 }}
            />
            <TextField
              size="small"
              fullWidth
              label="Mobile (optional)"
              value={payerPhone}
              error={!!phoneError}
              helperText={phoneError}
              onChange={(e) => setPayerPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 10))}
              placeholder="98765XXXXX"
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              fullWidth
              disabled={paying !== null || counterPending !== null || !!phoneError}
              title={phoneError || undefined}
              startIcon={<Sym name="bolt" size={20} />}
              sx={{ fontWeight: 800, height: 56, borderRadius: 2, backgroundImage: 'linear-gradient(90deg, #C2410C, #9B2F00)', justifyContent: 'space-between', px: 2 }}
              onClick={async () => {
                setPaying('mock');
                setPayError(null);
                try {
                  const res = await confirmMockPayment(token, 'MOCK_UPI', payerExtra());
                  setReceipt(res.data);
                  await load();
                } catch (e) {
                  setPayError(e.message);
                } finally {
                  setPaying(null);
                }
              }}
            >
              {paying === 'mock' ? 'Paying…' : `Pay Now via UPI · ₹${balanceDue.toFixed(2)}`}
            </Button>
            <Button
              variant="outlined"
              fullWidth
              disabled={paying !== null || counterPending !== null || !!phoneError}
              title={phoneError || undefined}
              sx={{ fontWeight: 700 }}
              onClick={async () => {
                setPaying('counter');
                setPayError(null);
                try {
                  const res = await payAtCounter(token, payerExtra());
                  if (res.data?.status === 'COMPLETED') {
                    setReceipt(res.data);
                    await load();
                  } else {
                    setCounterPending(res.data);
                  }
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

      <Box sx={{ display: 'flex', gap: 1, mb: 12 }}>
        <Button variant="text" fullWidth onClick={() => navigate(withBranch(base))} sx={{ fontWeight: 700, bgcolor: 'background.paper' }}>
          Order More
        </Button>
        <Button variant="text" fullWidth onClick={load} sx={{ fontWeight: 600 }}>
          Refresh bill
        </Button>
      </Box>
      <GuestBottomNav
        base={base}
        withBranch={withBranch}
        active="bill"
        latestOrderId={latestOrderId}
        onNeedOrder={() => setToast('No live orders yet — fire an order from the menu first.')}
      />
      {toast && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 168,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 60,
            bgcolor: '#1E1B19',
            color: '#fff',
            px: 2.5,
            py: 1.5,
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            boxShadow: 4,
          }}
          onClick={() => setToast(null)}
        >
          {toast}
        </Box>
      )}
    </CustomerLayout>
  );
}
