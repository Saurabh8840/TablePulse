import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import RemoveIcon from '@mui/icons-material/Remove';
import SearchIcon from '@mui/icons-material/Search';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  Paper,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { GuestBottomNav, GuestHeader, SessionSheet, Sym } from '../../components/guest/GuestChrome.jsx';
import CustomerLayout from '../../components/layout/CustomerLayout.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import VegMark from '../../components/VegMark.jsx';
import { CartProvider, useCart } from '../../context/CartContext.jsx';
import { useSession } from '../../hooks/useSession.js';
import { getPublicMenu, listSessionOrders } from '../../services/ordering.js';
import ItemModal from './ItemModal.jsx';

/** First-load shimmer mirroring the item rows — zero layout shift. */
function MenuSkeleton() {
  return (
    <Box sx={{ py: 1.5 }}>
      <Skeleton variant="rounded" height={120} sx={{ mb: 1.5 }} />
      <Skeleton variant="text" width="40%" height={28} sx={{ mb: 1 }} />
      {[0, 1, 2, 3].map((i) => (
        <Box key={i} sx={{ display: 'flex', gap: 2, py: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Skeleton variant="rounded" width={145} height={116} sx={{ flexShrink: 0 }} />
          <Box sx={{ flexGrow: 1 }}>
            <Skeleton variant="text" width="60%" height={26} />
            <Skeleton variant="text" width="35%" height={22} />
            <Skeleton variant="text" width="95%" height={18} />
          </Box>
        </Box>
      ))}
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

/** Guest dish card: info left, photo right, price + ADD/stepper footer. */
function ItemRow({ item, qty, onAdd, onDec, onCustomise }) {
  const customisable = (item.modifierGroups ?? []).length > 0;
  const groups = item.modifierGroups ?? [];
  const sizeGroup = groups.find((g) => g.required && g.maxSelections === 1 && (g.options ?? []).length > 1);
  return (
    <Box
      sx={{
        bgcolor: item.available ? 'background.paper' : '#FAF2EE',
        borderRadius: 2,
        p: 2,
        mb: 1.5,
        boxShadow: 1,
        opacity: item.available ? 1 : 0.85,
      }}
    >
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
            <VegMark veg={!!item.vegetarian} size={14} />
            {!item.available && (
              <Chip size="small" label="Sold Out" sx={{ height: 22, fontSize: 10, fontWeight: 800, bgcolor: '#EEE7E3' }} />
            )}
          </Box>
          <Typography variant="h6" fontWeight={700} fontSize={18} sx={{ pt: 0.5, lineHeight: 1.25 }}>
            {item.name}
          </Typography>
          {item.description && (
            <Typography variant="body2" fontSize={12} color="text.secondary" className="clamp-2" sx={{ mt: 0.25 }}>
              {item.description}
            </Typography>
          )}
          {customisable && (
            <Typography variant="caption" fontSize={10} color="primary.main" fontWeight={600} sx={{ display: 'block', mt: 0.5 }}>
              Customizable portion (Half / Full)
            </Typography>
          )}
        </Box>
        <Box sx={{
          width: 96, height: 96, flexShrink: 0,
          borderRadius: 2, overflow: 'hidden', bgcolor: 'action.hover',
          border: 1, borderColor: 'divider', position: 'relative',
        }}>
          <Box sx={{ position: 'absolute', inset: 0, filter: item.available ? 'none' : 'grayscale(0.7)' }}>
            <DishPhoto item={item} />
          </Box>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 1 }}>
        <Typography variant="h6" fontWeight={800} fontSize={20} sx={{ color: '#9B2F00', fontVariantNumeric: 'tabular-nums' }}>
          {sizeGroup
            ? <>From ₹{Number(item.price).toFixed(0)}
              <Typography component="span" variant="caption" color="text.secondary" sx={{ fontWeight: 400 }}>
                {' '}· up to ₹{(Number(item.price) + Math.max(...sizeGroup.options.map((o) => Number(o.additionalPrice ?? 0)))).toFixed(0)}
              </Typography></>
            : <>₹{Number(item.price).toFixed(0)}</>}
          {item.preparationTimeMinutes ? (
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75, fontWeight: 400 }}>
              ~{item.preparationTimeMinutes} min
            </Typography>
          ) : null}
        </Typography>
        {!item.available ? (
          <Chip size="small" label="Unavailable" sx={{ fontWeight: 700 }} />
        ) : customisable ? (
          <Button
            size="small"
            variant="contained"
            onClick={onCustomise}
            sx={{ height: 40, px: 2, borderRadius: 2, fontWeight: 800, backgroundImage: 'linear-gradient(90deg, #C2410C, #9B2F00)' }}
          >
            + ADD
          </Button>
        ) : (
          <DishStepper qty={qty} disabled={false} onAdd={onAdd} onDec={onDec} />
        )}
      </Box>
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const sectionRefs = useRef({});
  const searchBoxRef = useRef(null);
  const searchInputRef = useRef(null);

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

  const itemVisible = (item) => {
    const q = query.trim().toLowerCase();
    if (diet === 'veg' && !item.vegetarian) return false;
    if (diet === 'nonveg' && item.vegetarian) return false;
    if (q && !`${item.name} ${item.description ?? ''}`.toLowerCase().includes(q)) return false;
    return true;
  };

  /** Categories with ≥1 visible item — drives sidebar + sections together. */
  const visibleCats = useMemo(
    () => categories
      .map((c) => ({ ...c, visible: (c.items ?? []).filter(itemVisible) }))
      .filter((c) => c.visible.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, query, diet],
  );
  const visibleCount = useMemo(
    () => visibleCats.reduce((n, c) => n + c.visible.length, 0),
    [visibleCats],
  );

  // Scroll-spy: highlight the section currently in view.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveCat(e.target.dataset.catId);
        }
      },
      { rootMargin: '-25% 0px -65% 0px' },
    );
    const nodes = Object.values(sectionRefs.current).filter(Boolean);
    nodes.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [visibleCats]);

  function scrollToCat(id) {
    setActiveCat(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const withBranch = (path) => (branchId ? `${path}?b=${encodeURIComponent(branchId)}` : path);
  const base = `/r/${slug}/t/${table}`;

  const latestOrderId = useMemo(() => {
    const sorted = [...sessionOrders].sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));
    return sorted[0]?.id ?? null;
  }, [sessionOrders]);

  const marqueeDishes = useMemo(
    () => categories.flatMap((c) => c.items ?? []).slice(0, 3).map((i) => i.name),
    [categories],
  );

  const cycleDiet = () => setDiet((d) => (d === 'all' ? 'veg' : d === 'veg' ? 'nonveg' : 'all'));

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
      <GuestHeader
        restaurantName={restaurant?.name}
        tableLabel={`Table ${table}`}
        onSearch={() => {
          searchBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => searchInputRef.current?.focus(), 350);
        }}
        diet={diet}
        onDiet={cycleDiet}
        onPerson={() => setSheetOpen(true)}
      />
      <Box sx={{ height: 80 }} />
      {/* ── Welcome hero ── */}
      <Paper
        elevation={0}
        sx={{
          mt: 1.5,
          mb: 0,
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Box sx={{ position: 'absolute', right: -40, bottom: -40, width: 176, height: 176, borderRadius: '50%', bgcolor: 'rgba(255,219,208,.3)', filter: 'blur(32px)' }} />
        {restaurant?.coverUrl && (
          <Box sx={{ position: 'relative', height: { xs: 140, md: 180 }, overflow: 'hidden' }}>
            <Box
              component="img"
              src={restaurant.coverUrl}
              alt=""
              aria-hidden
              loading="eager"
              decoding="async"
              sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(255,248,245,.96) 0%, rgba(255,248,245,.25) 45%, transparent 75%)' }} />
          </Box>
        )}
        <Box sx={{ p: { xs: 2, md: 3 }, pb: { xs: 1.5, md: 2 } }}>
          <Box sx={{ display: 'flex', gap: 1.75, alignItems: 'flex-start' }}>
            <Box
              aria-hidden
              sx={{
                width: { xs: 52, md: 64 },
                height: { xs: 52, md: 64 },
                flexShrink: 0,
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
                bgcolor: '#fff',
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: { xs: 24, md: 30 },
                letterSpacing: '-0.02em',
                overflow: 'hidden',
              }}
            >
              {restaurant?.logoUrl ? (
                <Box component="img" src={restaurant.logoUrl} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                (restaurant?.name?.[0] ?? 'T').toUpperCase()
              )}
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
              {marqueeDishes.length > 0 && (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1.25, p: 1.25, borderRadius: 2, bgcolor: 'rgba(255,255,255,.7)' }}>
                  <Avatar sx={{ bgcolor: '#C2410C', width: 24, height: 24 }}>
                    <Sym name="local_fire_department" size={14} />
                  </Avatar>
                  <Typography variant="body2" fontWeight={700} fontSize={12} noWrap sx={{ flexGrow: 1, color: '#9B2F00' }}>
                    Today at {restaurant?.name}: {marqueeDishes.join(' · ')}
                  </Typography>
                  <Chip size="small" label="Today" sx={{ fontSize: 10, fontWeight: 800, color: '#9B2F00' }} />
                </Box>
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
          <Box ref={searchBoxRef} sx={{ scrollMarginTop: 150, display: 'flex', gap: 1, mb: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search butter chicken, parotta, mocktails..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              inputRef={searchInputRef}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: query ? (
                  <InputAdornment position="end">
                    <IconButton size="small" aria-label="Clear search" onClick={() => setQuery('')}>
                      <Sym name="close" size={16} />
                    </IconButton>
                  </InputAdornment>
                ) : null,
                sx: { borderRadius: 2, bgcolor: 'action.hover', height: 48 },
              }}
            />
          </Box>
          <Box className="no-scrollbar" sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.25, mb: 1 }}>
            {[
              ['veg', 'Veg Only', true],
              ['nonveg', 'Non-Veg', false],
            ].map(([v, l, veg]) => (
              <Chip
                key={v}
                clickable
                onClick={() => setDiet((d) => (d === v ? 'all' : v))}
                icon={<VegMark veg={veg} size={12} />}
                label={l}
                sx={diet === v
                  ? { bgcolor: '#9B2F00', color: '#fff', fontWeight: 800, fontSize: 12, height: 40, px: 1, '& .MuiChip-icon': { color: '#fff' } }
                  : { bgcolor: '#fff', fontWeight: 600, fontSize: 12, height: 40, px: 1, boxShadow: 1 }}
              />
            ))}
            {diet !== 'all' && (
              <Chip clickable onClick={() => setDiet('all')} label="Clear ×" sx={{ fontSize: 12, height: 40 }} />
            )}
          </Box>
          {/* Mobile category scroller — desktop uses the sticky sidebar below */}
          <Box
            className="no-scrollbar"
            sx={{ display: { xs: 'flex', md: 'none' }, gap: 1, overflowX: 'auto', pb: 0.25 }}
          >
            {visibleCats.map((c) => (
              <Chip
                key={c.id}
                label={`${c.name} (${c.visible.length})`}
                clickable
                color={activeCat === c.id ? 'primary' : 'default'}
                variant={activeCat === c.id ? 'filled' : 'outlined'}
                onClick={() => scrollToCat(c.id)}
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
          <Paper variant="outlined" sx={{ mt: 1.5, p: 1.5, borderRadius: 2 }}>
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

      {/* ── Category sidebar (desktop) + stacked sections ── */}
      <Box sx={{ py: 1.5 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, px: 0.5 }}>
          {visibleCount} dish{visibleCount === 1 ? '' : 'es'} · Full menu
        </Typography>
        {visibleCats.length === 0 ? (
          <EmptyState icon="🍽️" title="No items found" body="Try a different search or category." />
        ) : (
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', pb: 2 }}>
            {/* Sticky sidebar — desktop only */}
            <Box
              component="nav"
              aria-label="Menu categories"
              sx={{
                display: { xs: 'none', md: 'block' },
                width: 250, flexShrink: 0,
                position: 'sticky', top: 150,
                maxHeight: 'calc(100vh - 170px)', overflowY: 'auto',
                borderRight: 1, borderColor: 'divider', pr: 1.5, py: 0.5,
              }}
            >
              {visibleCats.map((c) => {
                const active = activeCat === c.id;
                return (
                  <Box
                    key={c.id}
                    onClick={() => scrollToCat(c.id)}
                    sx={{
                      display: 'flex', alignItems: 'baseline', gap: 1,
                      px: 1.25, py: 1.1, borderRadius: 2, cursor: 'pointer',
                      borderLeft: 3, borderColor: active ? 'primary.main' : 'transparent',
                      bgcolor: active ? 'action.hover' : 'transparent',
                      transition: 'background-color .15s',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Typography
                      variant="body2"
                      fontWeight={active ? 800 : 500}
                      color={active ? 'primary.main' : 'text.primary'}
                      sx={{ flexGrow: 1 }}
                    >
                      {c.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {c.visible.length}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
            {/* Sections */}
            <Box sx={{ flexGrow: 1, minWidth: 0, display: 'grid', gap: 3 }}>
              {visibleCats.map((c) => (
                <Box
                  key={c.id}
                  data-cat-id={c.id}
                  ref={(el) => { sectionRefs.current[c.id] = el; }}
                  sx={{ scrollMarginTop: 150 }}
                >
                  <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: '-0.01em', mb: 1 }}>
                    {c.name}
                    <Typography component="span" variant="body2" color="text.secondary" fontWeight={500} sx={{ ml: 1 }}>
                      {c.visible.length} item{c.visible.length === 1 ? '' : 's'}
                    </Typography>
                  </Typography>
                  <Box sx={{ display: 'grid', gap: 0 }}>
                    {c.visible.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        qty={(item.modifierGroups ?? []).length > 0 ? 0 : simpleQty(item.id)}
                        onAdd={() => handleAdd(item)}
                        onDec={() => decSimple(item.id)}
                        onCustomise={() => setSelected(item)}
                      />
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>
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
          elevation={8}
          sx={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 88,
            mx: 'auto',
            maxWidth: 688,
            m: { xs: 2, sm: 2 },
            p: 1.5,
            pl: 2,
            borderRadius: 2,
            backgroundImage: 'linear-gradient(90deg, #9B2F00, #C2410C)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            zIndex: 40,
          }}
        >
          <Avatar sx={{ bgcolor: 'rgba(255,255,255,.15)', width: 36, height: 36 }}>
            <Sym name="receipt_long" size={20} />
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={800} noWrap sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {totals.count} Item{totals.count === 1 ? '' : 's'} in Order
            </Typography>
            <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.1 }}>
              ₹{totals.amount.toFixed(0)}
            </Typography>
          </Box>
          <Button
            variant="contained"
            onClick={() => navigate(withBranch(`${base}/cart`))}
            endIcon={<Sym name="arrow_forward" size={18} />}
            sx={{ bgcolor: '#fff', color: '#9B2F00', backgroundImage: 'none', borderRadius: 2, fontWeight: 800, '&:hover': { bgcolor: '#FFF5ED' } }}
          >
            Review & KOT
          </Button>
        </Paper>
      )}

      {token && totals.count === 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', pb: 12 }}>
          Session active · refresh-safe, add more rounds anytime
        </Typography>
      )}
      {totals.count > 0 && <Box sx={{ pb: 16 }} />}

      <GuestBottomNav
        base={base}
        withBranch={withBranch}
        cart={totals}
        latestOrderId={latestOrderId}
        active="menu"
        onNeedOrder={() => setToast('No orders yet — add dishes first, then track them here.')}
      />
      <SessionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        table={table}
        waiterName={waiterName}
        orders={sessionOrders}
        base={base}
        withBranch={withBranch}
        navigate={navigate}
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

export default function CustomerMenu() {
  const { slug, table } = useParams();
  return (
    <CartProvider slug={slug} table={table}>
      <MenuInner />
    </CartProvider>
  );
}
