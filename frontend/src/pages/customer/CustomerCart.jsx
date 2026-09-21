import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
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
      <CustomerLayout title={`Table ${table} · Cart`} subtitle={restaurant?.name}>
        <EmptyState
          icon="🛒"
          title="Your cart is empty"
          body="Add something tasty from the menu — your table session stays active."
          actionLabel="Browse menu"
          onAction={() => navigate(withBranch(base))}
        />
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout title={`Table ${table} · Cart`} subtitle={restaurant?.name ?? slug}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gap: 1.5, mb: 2 }}>
        {lines.map((l) => (
          <Card key={l.key} variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" fontWeight={800}>
                    {l.name} × {l.qty}
                  </Typography>
                  {(l.modifiers ?? []).length > 0 && (
                    <Typography variant="body2" color="text.secondary">
                      {(l.modifiers ?? [])
                        .map((m) => (m.groupName ? `${m.groupName}: ${m.name}` : m.name))
                        .join(' · ')}
                      {l.modsTotal > 0 && ` (+₹${Number(l.modsTotal).toFixed(2)})`}
                    </Typography>
                  )}
                  {l.note && (
                    <Typography variant="caption" color="text.secondary">
                      “{l.note}”
                    </Typography>
                  )}
                  <Typography variant="body2" fontWeight={700} sx={{ mt: 0.5 }}>
                    ₹{((Number(l.unitPrice) + Number(l.modsTotal ?? 0)) * l.qty).toFixed(2)}
                  </Typography>
                  {/* Fix 4: merged lines carry qty — stepper instead of remove-only */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                    <Button size="small" variant="outlined" onClick={() => updateQty(l.key, l.qty - 1)} sx={{ minWidth: 32 }}>−</Button>
                    <Typography variant="body2" fontWeight={800} sx={{ minWidth: 28, textAlign: 'center' }}>{l.qty}</Typography>
                    <Button size="small" variant="outlined" disabled={l.qty >= 20} onClick={() => updateQty(l.key, l.qty + 1)} sx={{ minWidth: 32 }}>+</Button>
                  </Box>
                </Box>
                <Button size="small" color="error" onClick={() => removeLine(l.key)}>
                  Remove
                </Button>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      <TextField
        fullWidth
        size="small"
        label="Order note for kitchen (optional)"
        placeholder="Less spicy, no onion…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        sx={{ mb: 2 }}
      />

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 2, bgcolor: 'background.paper' }}>
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

      <Paper elevation={4} sx={{ position: 'sticky', bottom: 12, p: 1.25, borderRadius: 3, display: 'flex', gap: 1, zIndex: 10 }}>
        <Button variant="outlined" onClick={() => navigate(withBranch(base))} sx={{ flexShrink: 0 }}>
          + Add
        </Button>
        <Button variant="contained" fullWidth disabled={placing} onClick={handlePlace} sx={{ borderRadius: 2.5 }}>
          {placing ? 'Placing…' : `Place Order · ₹${total.toFixed(2)}`}
        </Button>
      </Paper>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1.5 }}>
        Prices locked at order time · kitchen gets modifiers + notes instantly
      </Typography>
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
