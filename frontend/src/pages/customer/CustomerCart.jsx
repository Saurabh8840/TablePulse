import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  Paper,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { GuestBottomNav, GuestHeader } from '../../components/guest/GuestChrome.jsx';
import CustomerLayout from '../../components/layout/CustomerLayout.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { CartProvider, useCart } from '../../context/CartContext.jsx';
import { useSession } from '../../hooks/useSession.js';
import { getPublicMenu, placeOrder } from '../../services/ordering.js';

function pct(base, percent) {
  const p = Number(percent ?? 0);
  if (!p) return 0;
  return (base * p) / 100;
}

function CartInner() {
  const { slug, table } = useParams();
  const [searchParams] = useSearchParams();
  const branchId = searchParams.get('b');
  const navigate = useNavigate();
  const { token, loading: sessionLoading, error: sessionError } = useSession(slug, table, branchId);
  const { lines, removeLine, updateQty, clear, totals } = useCart();

  const [restaurant, setRestaurant] = useState(null);
  const [note, setNote] = useState('');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getPublicMenu(slug);
        if (alive) setRestaurant(res.data?.restaurant ?? null);
      } catch {
        // tax preview is best-effort; bill endpoint is source of truth
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  const { subtotal, tax, service, total } = useMemo(() => {
    const sub = totals.amount;
    const t = pct(sub, restaurant?.taxPercentage);
    const s = pct(sub, restaurant?.serviceChargePercentage);
    return { subtotal: sub, tax: t, service: s, total: sub + t + s };
  }, [totals.amount, restaurant]);

  const withBranch = (path) => (branchId ? `${path}?b=${encodeURIComponent(branchId)}` : path);
  const base = `/r/${slug}/t/${table}`;

  async function handlePlace() {
    if (!token || lines.length === 0 || placing) return;
    setPlacing(true);
    setError(null);
    try {
      const res = await placeOrder({
        sessionToken: token,
        specialInstructions: note.trim() || undefined,
        items: lines.map((l) => ({
          menuItemId: l.menuItemId,
          quantity: l.qty,
          modifierOptionIds: (l.modifiers ?? []).map((m) => m.id),
          specialInstructions: l.note || undefined,
        })),
      });
      clear();
      setNote('');
      navigate(withBranch(`${base}/track/${res.data.id}`));
    } catch (e) {
      setError(e.message);
    } finally {
      setPlacing(false);
    }
  }

  if (sessionLoading) {
    return (
      <CustomerLayout title="Loading cart…">
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', mb: 2 }}>
          {[0, 1, 2].map((i) => (
            <Box key={i} sx={{ p: 2, borderBottom: i === 2 ? 0 : 1, borderColor: 'divider' }}>
              <Skeleton variant="text" width="60%" height={24} />
              <Skeleton variant="text" width="90%" height={18} />
              <Skeleton variant="text" width="30%" height={22} sx={{ mt: 0.5 }} />
            </Box>
          ))}
        </Paper>
        <Skeleton variant="rounded" height={120} />
      </CustomerLayout>
    );
  }

  if (sessionError) {
    return (
      <CustomerLayout title="Couldn't open this table">
        <EmptyState icon="⚠️" title="Session failed" body={sessionError}
          actionLabel="Back to menu" onAction={() => navigate(withBranch(base))} />
      </CustomerLayout>
    );
  }

  if (lines.length === 0) {
    return (
      <CustomerLayout>
        <GuestHeader restaurantName={restaurant?.name ?? '…'} tableLabel={`Table ${table}`} />
        <Box sx={{ height: 80 }} />
        <EmptyState
          icon="🛒"
          title="Your cart is empty"
          body="Add something tasty from the menu — your table session stays active."
          actionLabel="Browse menu"
          onAction={() => navigate(withBranch(base))}
        />
        <Box sx={{ pb: 12 }} />
        <GuestBottomNav base={base} withBranch={withBranch} />
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <GuestHeader restaurantName={restaurant?.name ?? '…'} tableLabel={`Table ${table}`} />
      <Box sx={{ height: 80 }} />
      <Typography variant="h6" fontWeight={800} fontSize={18} sx={{ mb: 0.25 }}>
        Review your cart
      </Typography>
      <Typography variant="caption" fontSize={10} color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        {totals.count} item{totals.count === 1 ? '' : 's'} · Table {table}
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', mb: 2 }}>
        {lines.map((l, idx) => (
          <Box
            key={l.key}
            sx={{
              p: 2,
              borderBottom: idx === lines.length - 1 ? 0 : 1,
              borderColor: 'divider',
              display: 'flex', gap: 1.5, alignItems: 'flex-start',
            }}
          >
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ letterSpacing: '-0.01em', lineHeight: 1.3 }}>
                {l.name}
              </Typography>
              {(l.modifiers ?? []).length > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {(l.modifiers ?? [])
                    .map((m) => (m.groupName ? `${m.groupName}: ${m.name}` : m.name))
                    .join(' · ')}
                  {l.modsTotal > 0 && ` (+₹${Number(l.modsTotal).toFixed(2)})`}
                </Typography>
              )}
              {l.note && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                  “{l.note}”
                </Typography>
              )}
              <Typography variant="body2" fontWeight={800} sx={{ mt: 0.5, fontVariantNumeric: 'tabular-nums' }}>
                ₹{((Number(l.unitPrice) + Number(l.modsTotal ?? 0)) * l.qty).toFixed(2)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <Box
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.25,
                    border: 1, borderColor: 'divider', borderRadius: 20, px: 0.25, py: 0.1,
                  }}
                >
                  <IconButton size="small" aria-label="decrease quantity" onClick={() => updateQty(l.key, l.qty - 1)} sx={{ width: 26, height: 26 }}>
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                  <Typography variant="body2" fontWeight={800} sx={{ minWidth: 20, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                    {l.qty}
                  </Typography>
                  <IconButton size="small" aria-label="increase quantity" disabled={l.qty >= 20} onClick={() => updateQty(l.key, l.qty + 1)} sx={{ width: 26, height: 26 }}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Button size="small" color="error" onClick={() => removeLine(l.key)} sx={{ fontWeight: 600 }}>
                  Remove
                </Button>
              </Box>
            </Box>
          </Box>
        ))}
      </Paper>

      <TextField
        fullWidth
        size="small"
        label="Order note for kitchen (optional)"
        placeholder="Less spicy, no onion…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        sx={{ mb: 2 }}
      />

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2, bgcolor: 'background.paper' }}>
        <Box sx={{ display: 'grid', gap: 0.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">Subtotal</Typography>
            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>₹{subtotal.toFixed(2)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              GST ({Number(restaurant?.taxPercentage ?? 0).toFixed(2)}%)
            </Typography>
            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>₹{tax.toFixed(2)}</Typography>
          </Box>
          {service > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                Service ({Number(restaurant?.serviceChargePercentage ?? 0).toFixed(2)}%)
              </Typography>
              <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>₹{service.toFixed(2)}</Typography>
            </Box>
          )}
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="subtitle1" fontWeight={800}>To pay</Typography>
            <Typography variant="h6" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>₹{total.toFixed(2)}</Typography>
          </Box>
        </Box>
      </Paper>

      <Paper
        elevation={8}
        sx={{
          position: 'sticky',
          bottom: 96,
          p: 1.25,
          pl: 2,
          borderRadius: 2,
          display: 'flex',
          gap: 1,
          zIndex: 10,
          backgroundImage: 'linear-gradient(90deg, #9B2F00, #C2410C)',
          color: '#fff',
          alignItems: 'center',
        }}
      >
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle2" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {totals.count} item{totals.count === 1 ? '' : 's'} · ₹{total.toFixed(0)}
          </Typography>
          <Typography variant="caption" fontSize={10} sx={{ color: '#FFDBD0' }}>
            GST included · fires KOT instantly
          </Typography>
        </Box>
        <Button
          variant="contained"
          disabled={placing}
          onClick={handlePlace}
          sx={{ bgcolor: '#fff', color: '#9B2F00', backgroundImage: 'none', borderRadius: 2, fontWeight: 800, '&:hover': { bgcolor: '#FFF5ED' } }}
        >
          {placing ? 'Placing…' : 'Fire KOT →'}
        </Button>
      </Paper>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1.5, pb: 12 }}>
        Prices locked at order time · kitchen gets modifiers + notes instantly
      </Typography>
      <GuestBottomNav base={base} withBranch={withBranch} cart={totals} />
    </CustomerLayout>
  );
}

export default function CustomerCart() {
  const { slug, table } = useParams();
  return (
    <CartProvider slug={slug} table={table}>
      <CartInner />
    </CartProvider>
  );
}
