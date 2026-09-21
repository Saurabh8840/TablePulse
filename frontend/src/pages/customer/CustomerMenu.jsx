import SearchIcon from '@mui/icons-material/Search';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  InputAdornment,
  Paper,
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
import { getPublicMenu } from '../../services/ordering.js';
import ItemModal from './ItemModal.jsx';

function MenuInner() {
  const { slug, table } = useParams();
  const [searchParams] = useSearchParams();
  const branchId = searchParams.get('b');
  const navigate = useNavigate();
  const { token, loading: sessionLoading, error: sessionError } = useSession(slug, table, branchId);
  const { addLine, addLines, totals } = useCart();

  const [menu, setMenu] = useState(null);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState(null);
  const [activeCat, setActiveCat] = useState(null);
  const [query, setQuery] = useState('');
  const [diet, setDiet] = useState('all');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getPublicMenu(slug);
        if (!alive) return;
        setMenu(res.data);
        setActiveCat(res.data?.categories?.[0]?.id ?? null);
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

  if (sessionLoading || menuLoading) {
    return (
      <CustomerLayout title="Loading menu…" subtitle="Getting the freshest items for your table">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
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
      {/* ── Restaurant hero ─────────────────────────────── */}
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
        <Box
          sx={{
            background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 55%, #7c2d12 100%)',
            color: '#fff',
            p: { xs: 2, md: 3 },
            position: 'relative',
          }}
        >
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Avatar
              src={restaurant?.logoUrl ?? undefined}
              variant="rounded"
              sx={{
                width: { xs: 56, md: 72 },
                height: { xs: 56, md: 72 },
                bgcolor: 'rgba(255,255,255,0.2)',
                fontWeight: 800,
                fontSize: { xs: 24, md: 32 },
                borderRadius: 3,
                border: '2px solid rgba(255,255,255,0.5)',
              }}
            >
              {!restaurant?.logoUrl && (restaurant?.name?.[0] ?? 'T')}
            </Avatar>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="h5" fontWeight={800} noWrap sx={{ fontSize: { xs: 20, md: 28 } }}>
                {restaurant?.name}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }} noWrap>
                {itemCount} dishes · Table {table} · GST {Number(restaurant?.taxPercentage ?? 0).toFixed(0)}%
                {Number(restaurant?.serviceChargePercentage ?? 0) > 0 &&
                  ` · Service ${Number(restaurant.serviceChargePercentage).toFixed(0)}%`}
              </Typography>
              {restaurant?.description && (
                <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }} className="clamp-1">
                  {restaurant.description}
                </Typography>
              )}
            </Box>
            <Chip
              label={`Table ${table}`}
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 800 }}
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
            {categories.length > 1 && (
              <Chip
                label="All"
                clickable
                variant={activeCat === null ? 'filled' : 'outlined'}
                color={activeCat === null ? 'primary' : 'default'}
                onClick={() => setActiveCat(null)}
                sx={{ flexShrink: 0 }}
              />
            )}
          </Box>
        </Box>
      </Paper>

      {/* ── Dish grid: 1 col phone, 2 col tablet/desktop ── */}
      <Box sx={{ py: 1.5 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, px: 0.5 }}>
          {visibleItems.length} dish{visibleItems.length === 1 ? '' : 'es'}
          {activeCat ? ` · ${categories.find((c) => c.id === activeCat)?.name ?? ''}` : ''}
        </Typography>
        {visibleItems.length === 0 ? (
          <EmptyState icon="🍽️" title="No items found" body="Try a different search or category." />
        ) : (
          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' },
              pb: totals.count > 0 ? 12 : 2,
            }}
          >
            {visibleItems.map((item) => (
              <Card
                key={item.id}
                variant="outlined"
                sx={{
                  borderRadius: 3,
                  overflow: 'hidden',
                  opacity: item.available ? 1 : 0.75,
                  transition: 'box-shadow .15s',
                  '&:hover': { boxShadow: 3 },
                }}
              >
                <CardContent sx={{ display: 'flex', gap: 1.5, p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                      <VegMark veg={!!item.vegetarian} />
                      {(item.modifierGroups ?? []).length > 0 && (
                        <Typography variant="caption" fontWeight={700} color="primary.main">
                          Customisable
                        </Typography>
                      )}
                      {!item.available && (
                        <Chip size="small" label="Sold out" color="warning" sx={{ height: 20 }} />
                      )}
                    </Box>
                    <Typography variant="subtitle1" fontWeight={800} lineHeight={1.25} className="clamp-1">
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
                          <Typography variant="body2" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            From ₹{base.toFixed(2)} · up to ₹{maxAbs.toFixed(2)}
                            <Chip size="small" label={`${sizeGroup.options.length} sizes`} color="secondary" sx={{ ml: 1, height: 20 }} />
                            {item.preparationTimeMinutes ? (
                              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1, fontWeight: 400 }}>
                                ~{item.preparationTimeMinutes} min
                              </Typography>
                            ) : null}
                          </Typography>
                        );
                      }
                      return (
                        <Typography variant="body2" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          ₹{Number(item.price).toFixed(2)}
                          {item.preparationTimeMinutes ? (
                            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1, fontWeight: 400 }}>
                              ~{item.preparationTimeMinutes} min
                            </Typography>
                          ) : null}
                        </Typography>
                      );
                    })()}
                    {item.description && (
                      <Typography variant="body2" color="text.secondary" className="clamp-2" sx={{ mt: 0.25, minHeight: 20 }}>
                        {item.description}
                      </Typography>
                    )}
                  </Box>
                  {/* Image + ADD like Swiggy */}
                  <Box sx={{ width: 118, flexShrink: 0, textAlign: 'center' }}>
                    <Box
                      sx={{
                        width: 118,
                        height: 96,
                        borderRadius: 2.5,
                        overflow: 'hidden',
                        bgcolor: 'action.hover',
                        border: 1,
                        borderColor: 'divider',
                        position: 'relative',
                      }}
                    >
                      {item.imageUrl ? (
                        <Box
                          component="img"
                          src={item.imageUrl}
                          alt={item.name}
                          loading="lazy"
                          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 32,
                            fontWeight: 800,
                            color: 'primary.main',
                            background: 'linear-gradient(135deg, #fff5ed, #ffe8d5)',
                          }}
                        >
                          {item.name?.[0]?.toUpperCase()}
                        </Box>
                      )}
                    </Box>
                    <Button
                      size="small"
                      variant={item.available ? 'contained' : 'outlined'}
                      disabled={!item.available}
                      onClick={() => handleAdd(item)}
                      sx={{
                        mt: -1.75,
                        position: 'relative',
                        minWidth: 88,
                        borderRadius: 2,
                        fontWeight: 800,
                        letterSpacing: 0.5,
                        bgcolor: item.available ? '#fff !important' : undefined,
                        color: item.available ? 'success.main !important' : undefined,
                        borderColor: '#d7d7d7 !important',
                        border: 1,
                        boxShadow: 2,
                        '&:hover': { boxShadow: 3 },
                      }}
                    >
                      {item.available ? 'ADD +' : 'Sold out'}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            ))}
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
          elevation={6}
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
            background: 'linear-gradient(135deg, #ea580c, #c2410c)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            zIndex: 30,
          }}
        >
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={800} noWrap>
              {totals.count} item{totals.count === 1 ? '' : 's'} · ₹{totals.amount.toFixed(2)}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              Extra charges at checkout · Tap to review
            </Typography>
          </Box>
          <Button
            variant="outlined"
            onClick={() => navigate(withBranch(`${base}/bill`))}
            sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.6)', fontWeight: 700 }}
          >
            Bill
          </Button>
          <Button
            variant="contained"
            onClick={() => navigate(withBranch(`${base}/cart`))}
            sx={{ bgcolor: '#fff !important', color: '#c2410c !important', fontWeight: 800 }}
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
