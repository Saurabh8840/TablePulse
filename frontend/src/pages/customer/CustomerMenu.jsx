import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import RemoveIcon from '@mui/icons-material/Remove';
import SearchIcon from '@mui/icons-material/Search';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  Paper,
  Skeleton,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import CustomerLayout from '../../components/layout/CustomerLayout.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import VegMark from '../../components/VegMark.jsx';
import { CartProvider, useCart } from '../../context/CartContext.jsx';
import { useSession } from '../../hooks/useSession.js';
import { getPublicMenu, listSessionOrders } from '../../services/ordering.js';
import ItemModal from './ItemModal.jsx';

/** First-load shimmer mirroring the photo-card heights — zero layout shift. */
function MenuSkeleton() {
  return (
    <Box sx={{ py: 1.5 }}>
      <Skeleton variant="rounded" height={120} sx={{ mb: 1.5 }} />
      <Skeleton variant="text" width="40%" height={28} sx={{ mb: 1 }} />
      <Box sx={{ display: 'grid', gap: '10px', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr', lg: '1fr 1fr 1fr 1fr' } }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Box key={i} sx={{ borderRadius: 3, overflow: 'hidden', border: 1, borderColor: 'divider' }}>
            <Skeleton variant="rectangular" height={0} sx={{ aspectRatio: '16 / 10' }} />
            <Box sx={{ p: 1.25 }}>
              <Skeleton variant="text" width="70%" height={22} />
              <Skeleton variant="text" width="45%" height={20} />
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** Dish photo with graceful fallback — broken/missing files become a monogram tile. */
function DishPhoto({ item }) {
  const [failed, setFailed] = useState(false);
  if (!item.imageUrl || failed) {
    return (
      <Box
        aria-hidden
        sx={{
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 44, fontWeight: 800, letterSpacing: '-0.02em',
          color: 'primary.main', bgcolor: 'action.hover',
        }}
      >
        {(item.name?.[0] ?? '·').toUpperCase()}
      </Box>
    );
  }
  return (
    <Box
      component="img"
      src={item.imageUrl}
      alt={item.name}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="dish-photo"
      sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform .3s ease' }}
    />
  );
}

/** Inline ADD → stepper for simple (no-modifier) dishes. */
function DishStepper({ qty, disabled, onAdd, onDec }) {
  const press = { transition: 'transform .12s ease', '&:active': { transform: 'scale(0.94)' } };
  if (qty <= 0) {
    return (
      <Button
        size="small"
        variant="outlined"
        disabled={disabled}
        onClick={onAdd}
        sx={{ minWidth: 76, borderRadius: 20, fontWeight: 800, letterSpacing: 0.4, bgcolor: 'background.paper', boxShadow: 1, ...press }}
      >
        ADD
      </Button>
    );
  }
  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.25,
        border: 1, borderColor: 'primary.main', borderRadius: 20, px: 0.25, py: 0.1,
        bgcolor: 'background.paper', boxShadow: 1,
      }}
    >
      <IconButton size="small" aria-label="remove one" onClick={onDec} sx={{ width: 26, height: 26, transition: 'transform .12s ease', '&:active': { transform: 'scale(0.88)' } }}>
        <RemoveIcon fontSize="small" />
      </IconButton>
      <Typography variant="body2" fontWeight={800} sx={{ minWidth: 20, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
        {qty}
      </Typography>
      <IconButton size="small" aria-label="add one" onClick={onAdd} sx={{ width: 26, height: 26, transition: 'transform .12s ease', '&:active': { transform: 'scale(0.88)' } }}>
        <AddIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

function MenuInner() {
  const { slug, table } = useParams();
  const [searchParams] = useSearchParams();
  const branchId = searchParams.get('b');
  const navigate = useNavigate();
  const { token, waiterName, loading: sessionLoading, error: sessionError } = useSession(slug, table, branchId);
  const { lines, addLine, addLines, updateQty, totals } = useCart();

  const [menu, setMenu] = useState(null);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState(null);
  const [activeCat, setActiveCat] = useState(null);
  const [query, setQuery] = useState('');
  const [diet, setDiet] = useState('all');
  const [selected, setSelected] = useState(null);
  const [sessionOrders, setSessionOrders] = useState([]);
  const [ordersOpen, setOrdersOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getPublicMenu(slug);
        if (!alive) return;
        setMenu(res.data);
        // Default: All items (activeCat stays null) — customer picks a category to narrow.
      } catch (e) {
        if (alive) setMenuError(e.message);
      } finally {
        if (alive) setMenuLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  // Ongoing orders at this table (re-scan / friend's phone joins same session).
  // Light 15s poll so another device's orders appear without manual refresh.
  useEffect(() => {
    if (!token) return;
    let alive = true;
    const fetchOrders = async () => {
      try {
        const res = await listSessionOrders(token);
        if (alive) setSessionOrders(res.data ?? []);
      } catch {
        // Menu stays usable even if the orders fetch fails.
      }
    };
    fetchOrders();
    const t = setInterval(fetchOrders, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [token]);

  const restaurant = menu?.restaurant;
  const categories = useMemo(() => menu?.categories ?? [], [menu]);
  const itemCount = useMemo(
    () => categories.reduce((n, c) => n + (c.items?.length ?? 0), 0),
    [categories],
  );

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = [];
    for (const c of categories) {
      if (activeCat && c.id !== activeCat) continue;
      for (const item of c.items ?? []) {
        if (diet === 'veg' && !item.vegetarian) continue;
        if (diet === 'nonveg' && item.vegetarian) continue;
        if (q && !`${item.name} ${item.description ?? ''}`.toLowerCase().includes(q)) continue;
        out.push({ ...item, _catName: c.name });
      }
    }
    return out;
  }, [categories, activeCat, query, diet]);

  const withBranch = (path) => (branchId ? `${path}?b=${encodeURIComponent(branchId)}` : path);
  const base = `/r/${slug}/t/${table}`;

  function handleAdd(item) {
    if ((item.modifierGroups ?? []).length > 0) {
      setSelected(item);
      return;
    }
    addLine({
      menuItemId: item.id,
      name: item.name,
      unitPrice: Number(item.price),
      qty: 1,
      modsTotal: 0,
      modifiers: [],
      note: undefined,
    });
  }

  /** Cart qty for the simple (no-modifier, no-note) line of a dish. */
  function simpleQty(itemId) {
    return lines
      .filter((l) => l.menuItemId === itemId && !(l.modifiers?.length) && !l.note)
      .reduce((n, l) => n + l.qty, 0);
  }

  function decSimple(itemId) {
    const match = lines.find((l) => l.menuItemId === itemId && !(l.modifiers?.length) && !l.note);
    if (match) updateQty(match.key, match.qty - 1);
  }

  if (sessionLoading || menuLoading) {
    return (
      <CustomerLayout title="Loading menu…" subtitle="Getting the freshest items for your table">
        <MenuSkeleton />
      </CustomerLayout>
    );
  }

  if (sessionError || menuError) {
    return (
      <CustomerLayout title="Couldn't open this table">
        <EmptyState
          icon="⚠️"
          title="QR link didn't work"
          body={sessionError ?? menuError}
          actionLabel="Try again"
          onAction={() => window.location.reload()}
        />
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout wide>
      {/* ── Restaurant hero: quiet paper, monogram, no imagery ── */}
      <Paper
        elevation={0}
        sx={{
          mt: 1.5,
          mb: 0,
          border: 1,
          borderColor: 'divider',
          borderRadius: { xs: 3, md: 4 },
          overflow: 'hidden',
        }}
      >
        <Box sx={{ p: { xs: 2, md: 3 }, pb: { xs: 1.5, md: 2 } }}>
          <Box sx={{ display: 'flex', gap: 1.75, alignItems: 'flex-start' }}>
            <Box
              aria-hidden
              sx={{
                width: { xs: 52, md: 64 },
                height: { xs: 52, md: 64 },
                flexShrink: 0,
                borderRadius: 3,
                border: 1,
                borderColor: 'divider',
                bgcolor: 'action.hover',
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: { xs: 24, md: 30 },
                letterSpacing: '-0.02em',
              }}
            >
              {(restaurant?.name?.[0] ?? 'T').toUpperCase()}
            </Box>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="h5" fontWeight={800} sx={{ fontSize: { xs: 21, md: 28 }, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {restaurant?.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }} noWrap>
                {itemCount} dishes · Table {table} · GST {Number(restaurant?.taxPercentage ?? 0).toFixed(0)}%
                {Number(restaurant?.serviceChargePercentage ?? 0) > 0 &&
                  ` · Service ${Number(restaurant.serviceChargePercentage).toFixed(0)}%`}
              </Typography>
              {waiterName && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                  Served by {waiterName}
                </Typography>
              )}
              {restaurant?.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} className="clamp-2">
                  {restaurant.description}
                </Typography>
              )}
            </Box>
            <Chip
              label={`Table ${table}`}
              variant="outlined"
              sx={{ fontWeight: 800, flexShrink: 0 }}
            />
          </Box>
        </Box>

        {/* ── Sticky search + filters ── */}
        <Box
          className="sticky-bar"
          sx={{ bgcolor: 'background.paper', p: { xs: 1.25, md: 1.5 }, borderTop: 1, borderColor: 'divider' }}
        >
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search noodles, coffee, paneer…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                sx: { borderRadius: 3, bgcolor: 'action.hover' },
              }}
            />
            <ToggleButtonGroup
              size="small"
              exclusive
              value={diet}
              onChange={(_, v) => v && setDiet(v)}
              aria-label="diet filter"
              sx={{ flexShrink: 0, '& .MuiToggleButton-root': { borderRadius: 3, px: 1.25 } }}
            >
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="veg" aria-label="veg only">
                <VegMark veg size={14} />
              </ToggleButton>
              <ToggleButton value="nonveg" aria-label="non-veg only">
                <VegMark veg={false} size={14} />
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Box className="no-scrollbar" sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.25 }}>
            <Chip
              label={`All (${itemCount})`}
              clickable
              variant={activeCat === null ? 'filled' : 'outlined'}
              color={activeCat === null ? 'primary' : 'default'}
              onClick={() => setActiveCat(null)}
              sx={{ flexShrink: 0, fontWeight: 700 }}
            />
            {categories.map((c) => (
              <Chip
                key={c.id}
                label={`${c.name} (${c.items?.length ?? 0})`}
                clickable
                color={activeCat === c.id ? 'primary' : 'default'}
                variant={activeCat === c.id ? 'filled' : 'outlined'}
                onClick={() => setActiveCat(c.id)}
                sx={{ flexShrink: 0, fontWeight: 700 }}
              />
            ))}
          </Box>
        </Box>
      </Paper>

      {/* ── Ongoing orders at this table (re-scan / shared table) ── */}
      {sessionOrders.length > 0 && (() => {
        const total = sessionOrders.reduce((n, o) => n + Number(o.totalAmount ?? 0), 0);
        const byStatus = sessionOrders.reduce((m, o) => {
          m[o.status] = (m[o.status] ?? 0) + 1;
          return m;
        }, {});
        return (
          <Paper variant="outlined" sx={{ mt: 1.5, p: 1.5, borderRadius: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <ReceiptLongIcon fontSize="small" color="primary" />
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" fontWeight={800}>
                  Order going on at this table — {sessionOrders.length} order{sessionOrders.length === 1 ? '' : 's'} · ₹{total.toFixed(2)}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                  {Object.entries(byStatus).map(([s, n]) => (
                    <Chip key={s} size="small" label={`${s} × ${n}`} color={s === 'READY' ? 'success' : 'default'} />
                  ))}
                </Box>
              </Box>
              <Button size="small" variant="outlined" onClick={() => navigate(withBranch(`${base}/bill`))}>
                View Bill
              </Button>
            </Box>
            <Accordion
              expanded={ordersOpen}
              onChange={(_, isOpen) => setOrdersOpen(isOpen)}
              disableGutters
              elevation={0}
              sx={{ mt: 1, bgcolor: 'transparent', '&:before': { display: 'none' } }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0, minHeight: 0 }}>
                <Typography variant="body2" fontWeight={700} color="primary.main">
                  {ordersOpen ? 'Hide current orders' : 'View all current orders'}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 0, pb: 0 }}>
                {sessionOrders.map((o) => (
                  <Box
                    key={o.id}
                    onClick={() => navigate(withBranch(`${base}/track/${o.id}`))}
                    sx={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      py: 1, px: 1, borderRadius: 2, cursor: 'pointer',
                      '&:hover': { bgcolor: 'background.paper' },
                    }}
                  >
                    <Box>
                      <Typography variant="body2" fontWeight={700}>{o.orderNumber}</Typography>
                      <Typography variant="caption" color="text.secondary">{o.status} · tap for details →</Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={700}>₹{Number(o.totalAmount).toFixed(2)}</Typography>
                  </Box>
                ))}
              </AccordionDetails>
            </Accordion>
          </Paper>
        );
      })()}

      {/* ── Photo cards: appetising, calm, reserved ratios ── */}
      <Box sx={{ py: 1.5 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, px: 0.5 }}>
          {visibleItems.length} dish{visibleItems.length === 1 ? '' : 'es'}
          {activeCat ? ` · ${categories.find((c) => c.id === activeCat)?.name ?? ''}` : ' · Full menu'}
        </Typography>
        {visibleItems.length === 0 ? (
          <EmptyState icon="🍽️" title="No items found" body="Try a different search or category." />
        ) : (
          <Box
            sx={{
              display: 'grid', gap: '10px',
              gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr', lg: '1fr 1fr 1fr 1fr' },
              pb: totals.count > 0 ? 12 : 2,
            }}
          >
            {visibleItems.map((item) => {
              const customisable = (item.modifierGroups ?? []).length > 0;
              const qty = customisable ? 0 : simpleQty(item.id);
              return (
              <Paper
                key={item.id}
                variant="outlined"
                sx={{
                  borderRadius: 3, overflow: 'hidden',
                  display: 'flex', flexDirection: 'column',
                  opacity: item.available ? 1 : 0.75,
                  transition: 'transform .18s ease, box-shadow .18s ease',
                  '&:hover': {
                    boxShadow: 4,
                    transform: { xs: 'none', sm: 'translateY(-3px)' },
                    '& .dish-photo': { transform: 'scale(1.06)' },
                  },
                  '&:active': { transform: { xs: 'scale(0.99)', sm: 'translateY(-1px)' } },
                }}
              >
                {/* Photo — fixed ratio reserves space, no layout shift */}
                <Box sx={{ position: 'relative', aspectRatio: '16 / 10', bgcolor: 'action.hover' }}>
                  <Box sx={{ position: 'absolute', inset: 0, filter: item.available ? 'none' : 'grayscale(0.7)' }}>
                    <DishPhoto item={item} />
                  </Box>
                  {!item.available && (
                    <Chip size="small" label="Sold out" color="warning" sx={{ position: 'absolute', top: 8, left: 8 }} />
                  )}
                  {/* Floating control overlapping the photo's bottom edge */}
                  <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, transform: 'translateY(50%)', display: 'flex', justifyContent: 'center', zIndex: 1 }}>
                    {!item.available ? null : customisable ? (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setSelected(item)}
                        sx={{ borderRadius: 20, fontWeight: 700, whiteSpace: 'nowrap', bgcolor: 'background.paper', boxShadow: 1, transition: 'transform .12s ease, box-shadow .15s ease', '&:hover': { boxShadow: 2 }, '&:active': { transform: 'scale(0.94)' } }}
                      >
                        Customise
                      </Button>
                    ) : (
                      <DishStepper
                        qty={qty}
                        disabled={false}
                        onAdd={() => handleAdd(item)}
                        onDec={() => decSimple(item.id)}
                      />
                    )}
                  </Box>
                </Box>
                {/* Editorial content — compact for the 2-col grid */}
                <Box sx={{ p: 1.25, pt: 2.75, flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                    <VegMark veg={!!item.vegetarian} size={12} />
                    {!activeCat && item._catName && (
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: 9 }}>
                        {item._catName}
                      </Typography>
                    )}
                    {customisable && (
                      <Typography variant="caption" fontWeight={700} color="primary.main" noWrap sx={{ fontSize: 10 }}>
                        Customisable
                      </Typography>
                    )}
                  </Box>
                    <Typography variant="subtitle2" fontWeight={700} lineHeight={1.3} sx={{ letterSpacing: '-0.01em' }} className="clamp-1">
                      {item.name}
                    </Typography>
                    {(() => {
                      // Fix 3: size-variant items show From ₹base + sizes badge,
                      // single-price items keep flat ₹210 display.
                      const groups = item.modifierGroups ?? [];
                      const sizeGroup = groups.find((g) => g.required && g.maxSelections === 1 && (g.options ?? []).length > 1);
                      if (sizeGroup) {
                        const base = Number(item.price);
                        const maxAbs = Math.max(...sizeGroup.options.map((o) => base + Number(o.additionalPrice ?? 0)));
                        return (
                          <Typography variant="body2" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums', mt: 0.25 }}>
                            From ₹{base.toFixed(2)}
                            <Typography component="span" variant="caption" color="text.secondary" sx={{ fontWeight: 400 }}>
                              {' '}· up to ₹{maxAbs.toFixed(2)}
                            </Typography>
                            {item.preparationTimeMinutes ? (
                              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75, fontWeight: 400 }}>
                                ~{item.preparationTimeMinutes} min
                              </Typography>
                            ) : null}
                          </Typography>
                        );
                      }
                      return (
                        <Typography variant="body2" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums', mt: 0.25 }}>
                          ₹{Number(item.price).toFixed(2)}
                          {item.preparationTimeMinutes ? (
                            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75, fontWeight: 400 }}>
                              ~{item.preparationTimeMinutes} min
                            </Typography>
                          ) : null}
                        </Typography>
                      );
                    })()}
                    {item.description && (
                      <Typography variant="caption" color="text.secondary" className="clamp-2" sx={{ mt: 0.25, display: '-webkit-box' }}>
                        {item.description}
                      </Typography>
                    )}
                </Box>
              </Paper>
              );
            })}
          </Box>
        )}
      </Box>

      {/* Item modal — Fix 4: matrix submit adds N size lines in one tap */}
      {selected && (
        <ItemModal
          item={selected}
          onClose={() => setSelected(null)}
          onAdd={(line) => {
            addLine(line);
            setSelected(null);
          }}
          onAddLines={(lines) => {
            addLines(lines);
            setSelected(null);
          }}
        />
      )}

      {/* Floating cart bar */}
      {totals.count > 0 && (
        <Paper
          elevation={4}
          sx={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            mx: 'auto',
            maxWidth: 720,
            m: { xs: 1.5, sm: 2 },
            p: 1.5,
            borderRadius: 3,
            border: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            zIndex: 30,
          }}
        >
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={800} noWrap sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {totals.count} item{totals.count === 1 ? '' : 's'} · ₹{totals.amount.toFixed(2)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Extra charges at checkout · Tap to review
            </Typography>
          </Box>
          <Button
            variant="text"
            onClick={() => navigate(withBranch(`${base}/bill`))}
            sx={{ fontWeight: 700 }}
          >
            Bill
          </Button>
          <Button
            variant="contained"
            onClick={() => navigate(withBranch(`${base}/cart`))}
            sx={{ fontWeight: 800 }}
          >
            View Cart →
          </Button>
        </Paper>
      )}

      {token && totals.count === 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', pb: 2 }}>
          Session active · refresh-safe, add more rounds anytime
        </Typography>
      )}
    </CustomerLayout>
  );
}

export default function CustomerMenu() {
  const { slug, table } = useParams();
  return (
    <CartProvider slug={slug} table={table}>
      <MenuInner />
    </CartProvider>
  );
}
