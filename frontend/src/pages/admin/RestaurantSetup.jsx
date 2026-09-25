import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  MenuItem,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import ModeToggle from '../../components/ModeToggle.jsx';
import DishPhotoField from '../../components/DishPhotoField.jsx';
import { getPublicMenu } from '../../services/ordering.js';
import { bulkCreateTables, listTables } from '../../services/tables.js';
import { createCategory, createItem, createModifierGroup, createModifierOption, listCategories, uploadItemImage } from '../../services/menu.js';
import { getRestaurant, listBranches } from '../../services/restaurant.js';
import { listStaff } from '../../services/staff.js';

const inr = (n) => `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function relTime(iso) {
  if (!iso) return 'Created just now';
  try {
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 0) return 'Created just now';
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'Created just now';
    if (mins < 60) return `Created ${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Created ${hrs}h ago`;
    return `Created ${Math.floor(hrs / 24)}d ago`;
  } catch {
    return 'Created just now';
  }
}

function Sym({ name, size = 20, color }) {
  return (
    <Box component="span" className="material-symbols-outlined" sx={{ fontSize: size, color, display: 'inline-flex' }}>
      {name}
    </Box>
  );
}

const TABS = [
  { label: 'Overview & Setup', active: true },
  { label: 'Menu', to: (id) => `/admin/restaurants/${id}/menu` },
  { label: 'Tables & QR', to: (id, branchId) => (branchId ? `/admin/branches/${branchId}/tables` : `/admin/restaurants/${id}`) },
  { label: 'Staff & Team', to: (id) => `/admin/staff?restaurantId=${id}` },
];

export default function RestaurantSetup() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [rest, setRest] = useState(null);
  const [branches, setBranches] = useState([]);
  const [cats, setCats] = useState([]);
  const [items, setItems] = useState([]);
  const [tableCount, setTableCount] = useState(0);
  const [team, setTeam] = useState({ kitchen: 0, waiter: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [soloSkipped, setSoloSkipped] = useState(() => {
    try {
      return localStorage.getItem(`tp_setup_skip_${id}`) === '1';
    } catch {
      return false;
    }
  });
  const [tablesSkipped, setTablesSkipped] = useState(() => {
    try {
      return localStorage.getItem(`tp_setup_skip_tables_${id}`) === '1';
    } catch {
      return false;
    }
  });

  // dish modal
  const [dishOpen, setDishOpen] = useState(false);
  const [dish, setDish] = useState({ name: '', price: '', categoryId: '', newCategory: '', diet: 'veg' });
  const [dishError, setDishError] = useState(null);
  const [dishSaving, setDishSaving] = useState(false);
  const [dishPhotoFile, setDishPhotoFile] = useState(null);
  const [dishPhotoPreview, setDishPhotoPreview] = useState(null);
  const [portionMode, setPortionMode] = useState('single'); // single | multi
  const [portions, setPortions] = useState([{ name: '', price: '' }, { name: '', price: '' }]);
  const [portionHelpOpen, setPortionHelpOpen] = useState(false);

  // ai modal (visual pilot)
  const [aiOpen, setAiOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);

  // quick tables
  const [genState, setGenState] = useState('idle'); // idle | busy | done

  const branch = branches[0] ?? null;
  const branchId = branch?.id ?? null;

  const boot = useCallback(() => {
    setLoading(true);
    setError(null);
    return Promise.all([getRestaurant(id), listBranches(id)])
      .then(([r, b]) => {
        setRest(r.data);
        const list = b.data ?? [];
        setBranches(list);
        return Promise.all([
          getPublicMenu(r.data.slug).catch(() => ({ data: { categories: [] } })),
          listCategories(id).catch(() => ({ data: [] })),
          Promise.all((list ?? []).map((x) => listTables(x.id).catch(() => ({ data: [] })))),
          listStaff({ restaurantId: id }).catch(() => ({ data: [] })),
        ]);
      })
      .then(([menu, categories, tableLists, staff]) => {
        const menuItems = (menu.data?.categories ?? []).flatMap((c) => c.items ?? []);
        setCats(categories.data ?? []);
        setItems(menuItems);
        setTableCount(tableLists.reduce((n, t) => n + ((t.data ?? []).filter((x) => x.active !== false).length), 0));
        const crew = staff.data ?? [];
        setTeam({
          kitchen: crew.filter((u) => u.role === 'KITCHEN_STAFF').length,
          waiter: crew.filter((u) => u.role === 'WAITER').length,
        });
        if ((categories.data ?? []).length > 0 && !dish.categoryId) {
          setDish((d) => ({ ...d, categoryId: d.categoryId || categories.data[0].id }));
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    boot();
  }, [boot]);

  const menuDone = items.length > 0;
  const tablesDone = tableCount > 0 || tablesSkipped;
  const teamDone = team.kitchen + team.waiter > 0 || soloSkipped;
  const completed = [menuDone, tablesDone, teamDone].filter(Boolean).length;
  const pct = Math.round((completed / 3) * 100);
  const live = menuDone && tablesDone;
  const preview = items.find((i) => i.imageUrl) ?? items[0] ?? null;

  const setSolo = (v) => {
    setSoloSkipped(v);
    try {
      if (v) localStorage.setItem(`tp_setup_skip_${id}`, '1');
      else localStorage.removeItem(`tp_setup_skip_${id}`);
    } catch {
      // ignore
    }
  };

  const setTablesSkip = (v) => {
    setTablesSkipped(v);
    try {
      if (v) localStorage.setItem(`tp_setup_skip_tables_${id}`, '1');
      else localStorage.removeItem(`tp_setup_skip_tables_${id}`);
    } catch {
      // ignore
    }
  };

  function pickDishPhoto(file) {
    if (!file) return;
    if (dishPhotoPreview) URL.revokeObjectURL(dishPhotoPreview);
    setDishPhotoFile(file);
    setDishPhotoPreview(URL.createObjectURL(file));
  }

  function clearDishPhoto() {
    if (dishPhotoPreview) URL.revokeObjectURL(dishPhotoPreview);
    setDishPhotoFile(null);
    setDishPhotoPreview(null);
  }

  function resetDishModal(keepCatId) {
    clearDishPhoto();
    setPortionMode('single');
    setPortions([{ name: '', price: '' }, { name: '', price: '' }]);
    setDishError(null);
    setDish((d) => ({ name: '', price: '', categoryId: keepCatId ?? d.categoryId, newCategory: '', diet: 'veg' }));
  }

  async function onSaveDish(e) {
    e.preventDefault();
    setDishError(null);
    const price = Number(dish.price);
    if (!dish.name.trim()) {
      setDishError('Dish name is required.');
      return;
    }
    if (!price || price < 0) {
      setDishError('Base price must be 0 or more.');
      return;
    }
    // Portions: free-form rows (S/M/L, 500ml/1L, 500g/1kg — anything).
    let rows = [];
    if (portionMode === 'multi') {
      rows = portions
        .map((p) => ({ name: p.name.trim(), price: Number(p.price) }))
        .filter((p) => p.name !== '' || p.price !== '');
      if (rows.length < 2) {
        setDishError('Add at least 2 portions (name + price each).');
        return;
      }
      if (rows.some((p) => !p.name || !(p.price >= 0))) {
        setDishError('Every portion needs a name and a price of 0 or more.');
        return;
      }
      const names = rows.map((p) => p.name.toLowerCase());
      if (new Set(names).size !== names.length) {
        setDishError('Portion names must be unique (e.g. Small, Medium, Large).');
        return;
      }
    }
    setDishSaving(true);
    try {
      let catId = dish.categoryId;
      if (!catId || catId === '__new') {
        if (!dish.newCategory.trim()) {
          setDishError('Create or pick a category first.');
          setDishSaving(false);
          return;
        }
        const c = await createCategory(id, { name: dish.newCategory.trim(), displayOrder: cats.length });
        catId = c.data.id;
      }
      const base = portionMode === 'multi' ? Math.min(...rows.map((p) => p.price)) : price;
      const created = await createItem(catId, {
        name: dish.name.trim(),
        price: base,
        vegetarian: dish.diet === 'veg',
        displayOrder: items.length,
      });
      const itemId = created.data.id;
      if (portionMode === 'multi') {
        const sizeLike = rows.every((p) => /^(s|m|l|xl|small|medium|large|regular|extra large)$/i.test(p.name));
        const g = await createModifierGroup(itemId, {
          name: sizeLike ? 'Size' : 'Quantity',
          required: true,
          minSelections: 1,
          maxSelections: 1,
          displayOrder: 0,
        });
        const gid = g.data.id;
        const sorted = [...rows].sort((a, b) => a.price - b.price);
        for (let i = 0; i < sorted.length; i += 1) {
          // eslint-disable-next-line no-await-in-loop
          await createModifierOption(gid, {
            name: sorted[i].name,
            additionalPrice: sorted[i].price - base,
            defaultOption: i === 0,
          });
        }
      }
      if (dishPhotoFile) {
        try {
          await uploadItemImage(itemId, dishPhotoFile);
        } catch {
          // Photo failed — dish is live; owner retries from Menu Manager.
        }
      }
      setDishOpen(false);
      resetDishModal(catId);
      boot();
    } catch (err) {
      setDishError(err.message);
    } finally {
      setDishSaving(false);
    }
  }

  async function onQuickTables() {
    if (!branchId || genState !== 'idle') return;
    setGenState('busy');
    try {
      await bulkCreateTables(branchId, { prefix: 'T', from: 1, to: 10, seatingCapacity: 4 });
      setGenState('done');
      boot();
    } catch (err) {
      setError(err.message);
      setGenState('idle');
    }
  }

  const setD = (k) => (e) => setDish((d) => ({ ...d, [k]: e.target.value }));

  return (
    <Box sx={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', bgcolor: '#FFF8F5', pb: { xs: '64px', md: 0 } }}>
      {/* Stitch h-28 desktop / h-16 mobile header */}
      <Box
        component="header"
        sx={(t) => ({
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          backdropFilter: 'blur(20px)',
          backgroundColor: t.palette.mode === 'light' ? 'rgba(255,248,245,0.95)' : 'rgba(20,17,16,0.9)',
          boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
        })}
      >
        <Container maxWidth="lg" disableGutters sx={{ px: { xs: 2, lg: 4 } }}>
          <Box sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', pt: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar sx={{ bgcolor: '#C2410C', width: 36, height: 36, borderRadius: 2 }}>
                    <Sym name="restaurant" size={22} color="#fff" />
                  </Avatar>
                  <Box sx={{ lineHeight: 1.1 }}>
                    <Typography variant="subtitle1" fontWeight={700} fontSize={18} sx={{ color: '#9B2F00' }}>
                      TablePulse
                    </Typography>
                    <Typography variant="caption" fontWeight={700} sx={{ letterSpacing: '.08em', fontSize: 10 }} color="text.secondary">
                      HOSPITALITY OS
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ width: 1, height: 24, bgcolor: 'divider', display: { xs: 'none', sm: 'block' } }} />
                <Box>
                  <Typography variant="body2" fontWeight={600} fontSize={14}>
                    {loading ? <Skeleton width={80} /> : (rest?.name ?? '…')}
                  </Typography>
                  <Typography variant="caption" fontWeight={800} fontSize={10} sx={{ color: live ? '#00632B' : '#9B2F00' }}>
                    {live ? 'Live • Accepting Orders' : 'Just Created • Setup in Progress'}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{ bgcolor: '#9B2F00', width: 32, height: 32 }}>
                  <Sym name="person" size={18} color="#fff" />
                </Avatar>
                <ModeToggle />
              </Box>
            </Box>
            <Box className="no-scrollbar" sx={{ display: 'flex', gap: 3, overflowX: 'auto', mt: 0.5 }}>
              {TABS.map((t) => (
                <Button
                  key={t.label}
                  onClick={() => {
                    if (!t.active) navigate(t.to(id, branchId), t.state ? { state: t.state } : undefined);
                  }}
                  sx={{
                    fontWeight: 600,
                    fontSize: 14,
                    color: t.active ? '#9B2F00' : 'text.secondary',
                    borderBottom: 2,
                    borderColor: t.active ? '#9B2F00' : 'transparent',
                    borderRadius: 0,
                    py: 1.25,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.label}
                </Button>
              ))}
            </Box>
          </Box>
          {/* mobile h-16 */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, height: 64, alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button size="small" onClick={() => navigate('/admin/restaurants')} sx={{ minWidth: 44, minHeight: 44 }}>
                <ArrowBackIcon fontSize="small" />
              </Button>
              <Box>
                <Typography variant="caption" fontWeight={800} fontSize={10} sx={{ letterSpacing: '.08em', color: '#9B2F00', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Sym name="restaurant" size={16} color="#9B2F00" /> TABLEPULSE
                </Typography>
                <Typography variant="subtitle2" fontWeight={700} fontSize={18}>
                  {loading ? '…' : (rest?.name ?? '…')}{' '}
                  <Typography component="span" variant="caption" color="text.secondary">• Overview</Typography>
                </Typography>
              </Box>
            </Box>
            <Avatar sx={{ bgcolor: '#9B2F00', width: 32, height: 32 }}>
              <Sym name="person" size={18} color="#fff" />
            </Avatar>
          </Box>
        </Container>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, pt: { xs: '64px', md: '112px' } }}>
        <Container maxWidth="lg" sx={{ py: 3, px: { xs: 2, lg: 4 } }}>
          {/* mobile status chips */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'space-between', mb: 2 }}>
            <Chip
              size="small"
              icon={<Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: live ? '#00632B' : '#BA1A1A', ml: 1 }} />}
              label={live ? 'Live • Online' : 'Setup Required · Offline'}
              sx={{ fontWeight: 800, fontSize: 10 }}
            />
            <Chip size="small" label="New Restaurant" sx={{ bgcolor: 'rgba(194,65,12,.08)', color: '#9B2F00', fontWeight: 800, fontSize: 10 }} />
          </Box>

          {/* breadcrumb + POS pill */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            <Typography variant="body2" fontWeight={600} fontSize={12} color="text.secondary">
              <RouterLink to="/admin/restaurants" style={{ textDecoration: 'none', color: 'inherit' }}>← All Restaurants</RouterLink>
              {' / '}<strong style={{ color: '#1E1B19' }}>{rest?.name ?? '…'}</strong>{' / '}
              <strong style={{ color: '#9B2F00' }}>Getting Started</strong>
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#FAF2EE', px: 1.5, py: 0.75, borderRadius: 999, fontSize: 10 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: live ? '#00632B' : '#BA1A1A' }} />
              <strong>POS Engine:</strong>
              <span>{!menuDone ? 'Awaiting menu to open orders' : tableCount > 0 ? 'Live — ready for orders' : tablesSkipped ? 'Takeaway-only mode' : 'Awaiting tables to open dine-in'}</span>
            </Box>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

          {/* gradient banner */}
          <Card sx={{ background: 'linear-gradient(90deg, #C2410C, #9B2F00, #C2410C)', color: '#fff', borderRadius: 2, mb: 2, position: 'relative', overflow: 'hidden' }}>
            <Box component="span" className="material-symbols-outlined" sx={{ position: 'absolute', right: -24, bottom: -32, fontSize: 160, opacity: 0.1 }}>
              storefront
            </Box>
            <CardContent sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 2, justifyContent: 'space-between', position: 'relative' }}>
              <Box sx={{ maxWidth: 640 }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
                  <Chip size="small" label="Live Onboarding" sx={{ bgcolor: 'rgba(255,255,255,.2)', color: '#fff', fontWeight: 800, fontSize: 10 }} />
                  <Typography variant="caption" fontSize={10} sx={{ color: '#FFDBD0' }}>Estimated time: ~4 minutes</Typography>
                </Box>
                <Typography variant="h5" fontWeight={700} fontSize={28}>
                  Restaurant Created! Complete 3 quick steps to accept your first dine-in order.
                </Typography>
                <Typography variant="body2" sx={{ color: '#FFDBD0', mt: 0.5 }}>
                  Your digital kitchen display, live QR codes, and smart soundbox triggers will instantly activate once step 1 and 2 are finished.
                </Typography>
              </Box>
              <Box sx={{ minWidth: 240, bgcolor: 'rgba(0,0,0,.15)', p: 1.5, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, mb: 1 }}>
                  <strong>Onboarding Progress</strong>
                  <strong style={{ color: '#FFDBD0' }}>{completed} of 3 ({pct}%)</strong>
                </Box>
                <Box sx={{ height: 10, borderRadius: 999, bgcolor: 'rgba(0,0,0,.25)', overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', width: `${Math.max(pct, 4)}%`, borderRadius: 999, background: 'linear-gradient(90deg, #FFB59D, #9CF2E8)', transition: 'width .7s' }} />
                </Box>
                <Typography variant="caption" fontSize={10} sx={{ color: '#FFDBD0' }}>
                  Next: {menuDone ? (tablesDone ? 'Invite your team or go live' : 'Set up tables — or skip for takeaway-only') : 'Create at least 1 menu category & dish'}
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* meta strip */}
          <Card sx={{ borderRadius: 2, mb: 3 }}>
            <CardContent sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', minWidth: 240 }}>
                <Avatar sx={{ bgcolor: '#FFDBD0', color: '#9B2F00', width: 56, height: 56, borderRadius: 2, fontWeight: 800, fontSize: 22 }}>
                  {loading ? '…' : ((rest?.name?.[0] ?? '·').toUpperCase())}
                </Avatar>
                <Box>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography variant="h6" fontWeight={600} fontSize={18}>
                      {loading ? <Skeleton width={120} /> : (rest?.name ?? '…')}
                    </Typography>
                    <Chip
                      size="small"
                      icon={<Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: live ? '#00632B' : '#BA1A1A', ml: 1 }} />}
                      label={live ? 'Live • Online' : 'Draft • Offline'}
                      sx={live
                        ? { bgcolor: 'rgba(17,126,59,.12)', color: '#00632B', fontWeight: 800, fontSize: 10 }
                        : { bgcolor: '#FFDAD6', color: '#93000A', fontWeight: 800, fontSize: 10 }}
                    />
                  </Box>
                  <Typography variant="body2" fontSize={12} color="text.secondary" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                    <span>📍 {branch?.address || 'Address not set yet'}</span>
                    <span>•</span>
                    <span>🕑 {relTime(branch?.createdAt)}</span>
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', ml: 'auto', flexWrap: 'wrap' }}>
                <Box sx={{ display: { xs: 'none', xl: 'flex' }, gap: 3, textAlign: 'right', pr: 2 }}>
                  <Box>
                    <Typography variant="caption" fontSize={10} color="text.secondary" sx={{ textTransform: 'uppercase' }}>Cuisine Type</Typography>
                    <Typography variant="body2" fontWeight={800} fontSize={14}>{rest?.description || 'Not set yet'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" fontSize={10} color="text.secondary" sx={{ textTransform: 'uppercase' }}>Default Tax</Typography>
                    <Typography variant="body2" fontWeight={800} fontSize={14} sx={{ color: '#00632B' }}>
                      {rest ? `${Number(rest.taxPercentage ?? 0)}% Restaurant GST` : '…'}
                    </Typography>
                  </Box>
                </Box>
                <Button
                  variant="outlined"
                  startIcon={<Sym name="edit" size={18} />}
                  onClick={() => navigate(`/admin/restaurants/${id}`, { state: { fromSetup: true } })}
                  sx={{ borderRadius: 2 }}
                >
                  Edit Restaurant Info
                </Button>
              </Box>
            </CardContent>
          </Card>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* roadmap header */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                <Box>
                  <Typography variant="caption" fontWeight={800} fontSize={10} sx={{ letterSpacing: '.15em', color: '#9B2F00' }}>
                    LAUNCH ROADMAP
                  </Typography>
                  <Typography variant="h5" fontWeight={700} fontSize={28}>
                    Finish setting up {rest?.name}
                  </Typography>
                </Box>
                <Typography variant="body2" fontSize={12} color="text.secondary" sx={{ alignSelf: 'flex-end' }}>
                  Setup can be completed in any order. Table stands unlock upon dish creation.
                </Typography>
              </Box>

              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: 'repeat(12, 1fr)' }, mb: 3 }}>
                {/* STEP 1 */}
                <Card sx={{ gridColumn: { lg: 'span 12', xl: 'span 7' }, borderRadius: 2, boxShadow: 3 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Avatar sx={{ bgcolor: '#9B2F00', color: '#fff', width: 28, height: 28, fontSize: 14, fontWeight: 800 }}>1</Avatar>
                        <Typography variant="body2" fontWeight={800} fontSize={14}>Step 1 • Menu Architecture</Typography>
                      </Box>
                      {menuDone ? (
                        <Chip size="small" icon={<CheckCircleIcon />} color="success" label={`Done • ${items.length} Dish${items.length === 1 ? '' : 'es'}`} sx={{ fontWeight: 800, fontSize: 10 }} />
                      ) : (
                        <Chip size="small" label="Needs Attention • 0 Dishes Added" sx={{ bgcolor: '#FFDAD6', color: '#93000A', fontWeight: 800, fontSize: 10 }} />
                      )}
                    </Box>
                    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '7fr 5fr' }, mb: 2 }}>
                      <Box>
                        <Typography variant="h6" fontWeight={700} fontSize={22}>Add your dishes & drinks</Typography>
                        <Typography variant="body2" fontSize={14} color="text.secondary" sx={{ mb: 1.5 }}>
                          Guests scan and browse your digital menu straight from their table. Auto-computes {rest ? `${Number(rest.taxPercentage ?? 0)}% GST` : 'GST'}, categorizes vegetarian badges, and sends KOT directly to the kitchen.
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, fontSize: 10, color: 'text.secondary', flexWrap: 'wrap' }}>
                          <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                            <Box sx={{ width: 14, height: 14, borderRadius: 1, border: '1px solid #00632B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#00632B' }} />
                            </Box>
                            Pure Veg Flagging
                          </Box>
                          <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                            <Box sx={{ width: 14, height: 14, borderRadius: 1, border: '1px solid #BA1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Box sx={{ width: 6, height: 6, bgcolor: '#BA1A1A', transform: 'rotate(45deg)' }} />
                            </Box>
                            Non-Veg Auto-Split
                          </Box>
                          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                            <Sym name="local_fire_department" size={15} color="#9B2F00" /> Spice Meters
                          </Box>
                        </Box>
                      </Box>
                      <Box sx={{ bgcolor: '#FAF2EE', borderRadius: 2, p: 1.5, position: 'relative', maxWidth: 240, width: '100%', mx: 'auto' }}>
                        <Chip size="small" label="Sample" sx={{ position: 'absolute', top: -8, right: -8, bgcolor: '#006A63', color: '#fff', fontSize: 10, fontWeight: 800 }} />
                        {preview?.imageUrl ? (
                          <Box component="img" src={preview.imageUrl} alt={preview.name} sx={{ width: '100%', height: 96, objectFit: 'cover', borderRadius: 2, mb: 1 }} />
                        ) : (
                          <Box sx={{ height: 96, borderRadius: 2, bgcolor: '#F4ECE8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 1 }}>
                            <Sym name="restaurant_menu" size={28} color="#9B2F00" />
                            <Typography variant="caption" fontSize={10} fontWeight={600}>Dish Preview</Typography>
                          </Box>
                        )}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" fontWeight={800} fontSize={12}>{preview?.name ?? 'Paneer Tikka Roll'}</Typography>
                          <Typography variant="body1" fontWeight={700} fontSize={16} sx={{ color: '#9B2F00' }}>
                            {preview ? inr(preview.price) : '₹249'}
                          </Typography>
                        </Box>
                        <Typography variant="body2" fontSize={12} color="text.secondary" noWrap>
                          {preview?.description ?? 'Charred cottage cheese, mint chutney'}
                        </Typography>
                        <Box sx={{ height: 24, bgcolor: '#C2410C', color: '#fff', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, mt: 1 }}>
                          + Add to Cart (Guest View)
                        </Box>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', flexDirection: { xs: 'column', sm: 'row' } }}>
                      <Button variant="contained" onClick={() => { resetDishModal(); setDishOpen(true); }} sx={{ px: 2.5, py: 1.5, borderRadius: 2, fontWeight: 800, backgroundImage: 'linear-gradient(90deg, #9B2F00, #7C2602)' }}>
                        + Add First Dish & Category
                      </Button>
                      <Button variant="outlined" onClick={() => { setAiStatus(null); setAiOpen(true); }} sx={{ px: 2, py: 1.5, borderRadius: 2, fontWeight: 800, bgcolor: '#FFDBD0' }}>
                        ⚡ Upload Menu PDF / Photo (AI Digitize in 60s)
                      </Button>
                    </Box>
                    <Typography variant="caption" fontSize={10} color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                      <strong>Or fast-start with preloaded menu kits:</strong>{' '}
                      <span title="Coming soon — pick dishes manually for now">North Indian Dhaba (60 items)</span> •{' '}
                      <span title="Coming soon">Bangalore Cafe & Brews (42 items)</span> •{' '}
                      <span title="Coming soon">South Indian Tiffin</span>
                    </Typography>
                    <Box sx={{ mt: 2, p: 1.5, bgcolor: '#FAF2EE', borderRadius: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Sym name="verified" size={18} color="#9B2F00" />
                      <Typography variant="body2" fontSize={12} color="text.secondary">
                        Menu instantly mirrors onto table QR codes and captains&apos; tablets with zero downtime.
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>

                {/* STEP 2 */}
                <Card sx={{ gridColumn: { lg: 'span 6', xl: 'span 5' }, borderRadius: 2 }}>
                  <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: 2 }}>
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Avatar sx={{ bgcolor: tablesDone ? '#9B2F00' : '#E9E1DD', color: tablesDone ? '#fff' : '#59413A', width: 28, height: 28, fontSize: 14, fontWeight: 800 }}>2</Avatar>
                          <Typography variant="body2" fontWeight={800} fontSize={14}>Step 2 • Floor Plan</Typography>
                        </Box>
                        {tableCount > 0 ? (
                          <Chip size="small" icon={<CheckCircleIcon />} color="success" label={`Done • ${tableCount} Tables`} sx={{ fontWeight: 800, fontSize: 10 }} />
                        ) : tablesSkipped ? (
                          <Chip size="small" label="Skipped • Takeaway only" sx={{ bgcolor: '#EEE7E3', color: '#59413A', fontWeight: 800, fontSize: 10 }} />
                        ) : (
                          <Chip size="small" label="Not Configured" sx={{ bgcolor: '#EEE7E3', fontWeight: 800, fontSize: 10 }} />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" fontWeight={700} fontSize={22}>Set up tables + QR stands</Typography>
                          <Typography variant="body2" fontSize={14} color="text.secondary">
                            Assign tables to sections (Indoor AC, Balcony, Rooftop) and print dynamic QR stands with your brand logo.
                          </Typography>
                        </Box>
                        <Box sx={{ width: 80, height: 96, borderRadius: 2, bgcolor: '#F4ECE8', p: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                          <Typography variant="caption" fontWeight={800} fontSize={10} sx={{ color: '#9B2F00' }}>TABLE #01</Typography>
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#1E1B19' }}>
                            <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm13-2h3v2h-3v-2zm-3 2h2v3h-2v-3zm3 3h3v3h-3v-3zm-5 0h2v3h-2v-3z" />
                          </svg>
                          <Typography variant="caption" fontWeight={800} fontSize={8} sx={{ color: '#00632B' }}>SCAN TO DINE</Typography>
                        </Box>
                      </Box>
                      <Box sx={{ p: 1.5, bgcolor: 'rgba(153,239,229,.25)', borderRadius: 2, display: 'flex', gap: 1 }}>
                        <Sym name="local_shipping" size={18} color="#006A63" />
                        <Typography variant="body2" fontSize={12}>
                          <strong style={{ color: '#006A63' }}>Free Acrylic Stands:</strong> 10 matte acrylic stands printed with {rest?.name ?? 'your'} logo ship automatically upon table setup.
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Button
                        fullWidth
                        variant="outlined"
                        onClick={() => branchId && navigate(`/admin/branches/${branchId}/tables`)}
                        disabled={!branchId}
                        sx={{ py: 1.5, borderRadius: 2, fontWeight: 800 }}
                      >
                        Configure Dining Room & Tables
                      </Button>
                      <Button
                        fullWidth
                        variant="text"
                        onClick={onQuickTables}
                        disabled={!branchId || genState !== 'idle'}
                        sx={{ fontWeight: 800, color: genState === 'done' ? '#00632B' : '#9B2F00' }}
                      >
                        {genState === 'done' ? '✓ 10 Tables Generated! QR codes ready.' : genState === 'busy' ? 'Generating Tables T-01 through T-10…' : 'Quick-generate 10 Tables (T-01 to T-10) with 1 click'}
                      </Button>
                      <Button
                        fullWidth
                        variant="text"
                        onClick={() => setTablesSkip(!tablesSkipped)}
                        sx={{ fontWeight: 700, color: tablesSkipped ? '#00632B' : 'text.secondary' }}
                      >
                        {tablesSkipped ? '✓ Takeaway only (Active) — tap to add tables' : 'We have no tables — takeaway / delivery only'}
                      </Button>
                    </Box>
                  </CardContent>
                </Card>

                {/* STEP 3 */}
                <Card sx={{ gridColumn: { lg: 'span 6', xl: 'span 12' }, borderRadius: 2 }}>
                  <CardContent sx={{ p: 3, display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 2, alignItems: { lg: 'center' }, justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', lg: 'row' }, alignItems: { lg: 'center' }, maxWidth: 720 }}>
                      <Box sx={{ flexShrink: 0 }}>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
                          <Avatar sx={{ bgcolor: teamDone ? '#9B2F00' : '#E9E1DD', color: teamDone ? '#fff' : '#59413A', width: 28, height: 28, fontSize: 14, fontWeight: 800 }}>3</Avatar>
                          <Typography variant="body2" fontWeight={800} fontSize={14}>Step 3 • Staff & Access</Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={team.kitchen + team.waiter > 0 ? `Team Active • ${team.kitchen + team.waiter} member${team.kitchen + team.waiter === 1 ? '' : 's'}` : 'Optional • Solo Owner Mode Active'}
                          sx={{ bgcolor: 'rgba(153,239,229,.4)', color: '#00504A', fontWeight: 800, fontSize: 10 }}
                        />
                      </Box>
                      <Box sx={{ width: 1, alignSelf: 'stretch', bgcolor: 'divider', display: { xs: 'none', lg: 'block' } }} />
                      <Box>
                        <Typography variant="h6" fontWeight={600} fontSize={18}>Invite your Kitchen Chef & Captains</Typography>
                        <Typography variant="body2" fontSize={14} color="text.secondary">
                          Waiters get phone ordering terminals; kitchen staff get hands-free KDS. Or run the full restaurant solo from your own device.
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' }, flexShrink: 0 }}>
                      <Button variant="outlined" onClick={() => navigate(`/admin/staff?restaurantId=${id}${branchId ? `&branchId=${branchId}` : ''}`)} sx={{ borderRadius: 2, fontWeight: 800 }}>
                        + Invite Chef or Captain
                      </Button>
                      <Button
                        variant="text"
                        onClick={() => setSolo(!soloSkipped)}
                        sx={{ color: soloSkipped ? '#00632B' : 'text.secondary', fontWeight: 700 }}
                      >
                        {soloSkipped ? '✓ Solo Operator (Active)' : 'Solo Operator (Active)'}
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Box>

              {/* secondary strip */}
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: 'repeat(3, 1fr)' }, mb: 2 }}>
                <Card sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', gap: 1.5, mb: 1 }}>
                      <Avatar sx={{ bgcolor: 'rgba(194,65,12,.12)', color: '#9B2F00', borderRadius: 2, width: 40, height: 40 }}>
                        <Sym name="receipt_long" size={22} />
                      </Avatar>
                      <Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Typography variant="h6" fontWeight={600} fontSize={18}>GST & Invoicing</Typography>
                          <Chip size="small" label="Optional Pilot" sx={{ bgcolor: '#F4ECE8', fontSize: 10 }} />
                        </Box>
                        <Typography variant="body2" fontSize={12} color="text.secondary" sx={{ mt: 0.5 }}>
                          Add your GSTIN for Indian Tax Invoices with B2C QR codes and monthly GSTR-1 CSV sheets.
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 1 }}>
                      <Typography variant="caption" fontSize={10} color="text.secondary">
                        Status: {rest ? `${Number(rest.taxPercentage ?? 0)}% Comp. mode` : '…'}
                      </Typography>
                      <Button size="small" onClick={() => navigate(`/admin/restaurants/${id}`, { state: { fromSetup: true } })} sx={{ fontWeight: 800, color: '#9B2F00' }}>
                        Add Tax Details ›
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
                <Card sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', gap: 1.5, mb: 1 }}>
                      <Avatar sx={{ bgcolor: 'rgba(121,219,141,.3)', color: '#00632B', borderRadius: 2, width: 40, height: 40 }}>
                        <Sym name="speaker_phone" size={22} />
                      </Avatar>
                      <Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Typography variant="h6" fontWeight={600} fontSize={18}>Soundbox & KOT Print</Typography>
                          <Chip size="small" label="Cloud Synced" sx={{ bgcolor: 'rgba(17,126,59,.12)', color: '#00632B', fontWeight: 800, fontSize: 10 }} />
                        </Box>
                        <Typography variant="body2" fontSize={12} color="text.secondary" sx={{ mt: 0.5 }}>
                          Auto-announce UPI settlements in Hindi/Kannada/English. Supports 80mm ESC/POS USB & Bluetooth printers.
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 1 }}>
                      <Typography variant="caption" fontSize={10} color="text.secondary">0 Peripherals Linked</Typography>
                      <Chip size="small" label="Coming soon" sx={{ fontSize: 10, fontWeight: 800, bgcolor: '#F4ECE8' }} />
                    </Box>
                  </CardContent>
                </Card>
                <Card sx={{ borderRadius: 2, background: 'linear-gradient(135deg, #FAF2EE, #EEE7E3)', gridColumn: { xs: 'span 1', md: 'span 2', lg: 'span 1' } }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
                      <Avatar sx={{ bgcolor: '#99EFE5', color: '#006A63', borderRadius: 2, width: 40, height: 40 }}>
                        <Sym name="support_agent" size={22} />
                      </Avatar>
                      <Box>
                        <Typography variant="h6" fontWeight={600} fontSize={18}>Need a 5-min hand?</Typography>
                        <Typography variant="body2" fontSize={12} color="text.secondary" sx={{ mt: 0.5 }}>
                          Our onboarding team will configure your food catalog and table maps free over WhatsApp or call.
                        </Typography>
                      </Box>
                    </Box>
                    <Button
                      fullWidth
                      variant="contained"
                      href="https://wa.me/919876543210"
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ borderRadius: 2, bgcolor: '#fff', color: '#1E1B19', backgroundImage: 'none', fontWeight: 800, boxShadow: 1, '&:hover': { bgcolor: '#fff' } }}
                    >
                      WhatsApp Concierge
                    </Button>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1 }}>
                      <Chip size="small" label="Demo number" sx={{ fontSize: 10, fontWeight: 800, bgcolor: '#F4ECE8' }} />
                      <Typography variant="caption" fontSize={10} color="text.secondary">
                        +91 98765 43210 — real helpline plugs in at launch.
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            </>
          )}
        </Container>
      </Box>

      {/* dish modal — real create */}
      <Dialog open={dishOpen} onClose={() => setDishOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Avatar sx={{ bgcolor: '#FFDBD0', color: '#9B2F00', borderRadius: 2, width: 32, height: 32 }}>
              <Sym name="soup_kitchen" size={20} />
            </Avatar>
            <Typography variant="h6" fontWeight={600} fontSize={18}>Add First Dish to {rest?.name ?? '…'}</Typography>
          </Box>
          <Button size="small" onClick={() => setDishOpen(false)}>✕</Button>
        </DialogTitle>
        <Box component="form" onSubmit={onSaveDish}>
          <DialogContent sx={{ display: 'grid', gap: 2 }}>
            <TextField label="Dish or Beverage Name" required value={dish.name} onChange={setD('name')} placeholder="e.g. Butter Chicken or Paneer Butter Masala" />
            <DishPhotoField
              previewUrl={dishPhotoPreview}
              placeholder={dish.name?.[0]?.toUpperCase()}
              onPick={pickDishPhoto}
              onRemove={clearDishPhoto}
              disabled={dishSaving}
            />
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
              <TextField label={portionMode === 'multi' ? 'Base Price (₹) — auto from portions' : 'Base Price (₹)'} required type="number" value={portionMode === 'multi' ? '' : dish.price} onChange={setD('price')} placeholder="280" disabled={portionMode === 'multi'} />
              {cats.length > 0 ? (
                <TextField label="Category" select value={dish.categoryId} onChange={setD('categoryId')}>
                  {cats.map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                  <MenuItem value="__new">+ New category…</MenuItem>
                </TextField>
              ) : (
                <TextField label="New Category" required value={dish.newCategory} onChange={setD('newCategory')} placeholder="Main Course (Gravies)" />
              )}
            </Box>
            {(dish.categoryId === '__new' || cats.length === 0) && cats.length > 0 && (
              <TextField label="New Category Name" required value={dish.newCategory} onChange={setD('newCategory')} placeholder="Starters & Tandoor" />
            )}
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.5, display: 'grid', gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="body2" fontWeight={700} fontSize={14} sx={{ flexGrow: 1 }}>
                  Portions
                </Typography>
                <Button size="small" onClick={() => setPortionMode(portionMode === 'multi' ? 'single' : 'multi')} sx={{ fontWeight: 800 }}>
                  {portionMode === 'multi' ? 'Single price instead' : 'Add portions (S/M/L, ml, kg…)'}
                </Button>
                <Button size="small" onClick={() => setPortionHelpOpen(true)} sx={{ textTransform: 'none', fontWeight: 700 }}>
                  How to do portions?
                </Button>
              </Box>
              {portionMode === 'multi' ? (
                <Box sx={{ display: 'grid', gap: 1 }}>
                  {portions.map((p, i) => (
                    <Box key={i} sx={{ display: 'grid', gap: 1, gridTemplateColumns: '1fr 110px 40px' }}>
                      <TextField size="small" label={`Portion ${i + 1} name`} value={p.name}
                        onChange={(e) => setPortions((rows) => rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
                        placeholder={i === 0 ? 'Small' : i === 1 ? 'Medium' : i === 2 ? 'Large' : 'Portion name'}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                      <TextField size="small" label="Price ₹" type="number" value={p.price}
                        onChange={(e) => setPortions((rows) => rows.map((r, j) => (j === i ? { ...r, price: e.target.value } : r)))}
                        placeholder="199"
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                      <Button size="small" disabled={portions.length <= 2} onClick={() => setPortions((rows) => rows.filter((_, j) => j !== i))} sx={{ minWidth: 0 }}>
                        ✕
                      </Button>
                    </Box>
                  ))}
                  <Button size="small" variant="outlined" onClick={() => setPortions((rows) => [...rows, { name: '', price: '' }])} sx={{ borderRadius: 2, justifySelf: 'start' }}>
                    + Add portion
                  </Button>
                  <Typography variant="caption" fontSize={10} color="text.secondary">
                    Type anything — S/M/L, 250ml/500ml/1L, 500g/1kg. Smallest price becomes the base; guests pick portions on the QR menu.
                  </Typography>
                </Box>
              ) : (
                <Typography variant="caption" fontSize={10} color="text.secondary">
                  One dish, one price. Choose portions for size or quantity variants.
                </Typography>
              )}
            </Box>
            <Box>
              <Typography variant="body2" fontWeight={600} fontSize={12} sx={{ mb: 1 }}>Dietary Flag</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
                {[
                  ['veg', 'Veg', '#00632B'],
                  ['non-veg', 'Non-Veg', '#BA1A1A'],
                  ['egg', 'Egg', '#D97706'],
                ].map(([v, l, c]) => (
                  <Box
                    key={v}
                    onClick={() => setDish((d) => ({ ...d, diet: v }))}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: '#FAF2EE',
                      border: 2,
                      borderColor: dish.diet === v ? '#9B2F00' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1,
                      cursor: 'pointer',
                    }}
                  >
                    <Box sx={{ width: 12, height: 12, borderRadius: 1, border: `1.5px solid ${c}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: c }} />
                    </Box>
                    <Typography variant="caption" fontWeight={800} fontSize={10}>{l}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
            {dishError && <Alert severity="error">{dishError}</Alert>}
          </DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, p: 2, pt: 0 }}>
            <Button onClick={() => setDishOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={dishSaving} sx={{ borderRadius: 2, backgroundImage: 'linear-gradient(90deg, #9B2F00, #7C2602)' }}>
              {dishSaving ? 'Saving…' : 'Save & Activate Step 1'}
            </Button>
          </Box>
        </Box>
      </Dialog>

      {/* portions how-to — worked examples, any unit allowed */}
      <Dialog open={portionHelpOpen} onClose={() => setPortionHelpOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={800} fontSize={18}>How to do portions</Typography>
          <Button size="small" onClick={() => setPortionHelpOpen(false)}>✕</Button>
        </DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            One dish, many sizes. Type each portion name with its <strong>full price</strong> —
            the smallest becomes the base price automatically. Guests pick a portion on the QR menu.
          </Typography>
          {[
            ['Tea-style sizes', 'Cutting / Small ₹20 · Medium ₹30 · Large ₹40', 'Names like Small/Medium/Large are grouped under “Size”.'],
            ['Beverage quantities', '250ml ₹60 · 500ml ₹110 · 1L ₹200', 'Any unit works — ml, L, pieces, plates. Grouped under “Quantity”.'],
            ['Biryani by weight', '500g ₹249 · 1kg ₹449', 'Heavier portions cost more; the cheapest row is the base price shown first.'],
          ].map(([t, e, b]) => (
            <Box key={t} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={800}>{t}</Typography>
              <Typography variant="body2" fontWeight={700} sx={{ color: '#9B2F00', mt: 0.5 }}>{e}</Typography>
              <Typography variant="body2" fontSize={12} color="text.secondary" sx={{ mt: 0.5 }}>{b}</Typography>
            </Box>
          ))}
          <Typography variant="body2" fontSize={12} color="text.secondary">
            Rule of thumb: 2 or more rows, unique names, prices lowest → highest. That&apos;s it.
          </Typography>
        </DialogContent>
      </Dialog>

      {/* AI modal — visual pilot */}
      <Dialog open={aiOpen} onClose={() => setAiOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Avatar sx={{ bgcolor: '#FFDBD0', color: '#9B2F00', borderRadius: 2, width: 32, height: 32 }}>
              <Sym name="document_scanner" size={20} />
            </Avatar>
            <Typography variant="h6" fontWeight={600} fontSize={18}>AI Menu Digitizer</Typography>
          </Box>
          <Button size="small" onClick={() => setAiOpen(false)}>✕</Button>
        </DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2 }}>
          <Box sx={{ border: '2px dashed #E1BFB5', borderRadius: 2, p: 4, textAlign: 'center', bgcolor: '#FAF2EE' }}>
            <Sym name="cloud_upload" size={40} color="#9B2F00" />
            <Typography variant="body1" fontWeight={800} fontSize={14} sx={{ mt: 1 }}>
              Drag and drop your menu PDF, JPEG, or Zomato/Swiggy link
            </Typography>
            <Typography variant="body2" fontSize={12} color="text.secondary">
              Parses 50+ dishes in ~45 seconds. Pilot only — our team digitizes free meanwhile.
            </Typography>
            <Button variant="contained" onClick={() => setAiStatus('⚡ Analyzing menu layout... Parsing categories and spice tags! (pilot preview)')} sx={{ mt: 2, borderRadius: 2 }}>
              Select Menu File
            </Button>
          </Box>
          {aiStatus && <Alert severity="info">{aiStatus}</Alert>}
        </DialogContent>
      </Dialog>

      {/* mobile bottom nav */}
      <Box
        component="nav"
        sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          bgcolor: 'rgba(255,248,245,0.9)',
          backdropFilter: 'blur(20px)',
          justifyContent: 'space-around',
          alignItems: 'center',
          height: 64,
        }}
      >
        {[
          ['dashboard', 'Overview', null, true],
          ['restaurant_menu', 'Menu', `/admin/restaurants/${id}/menu`, false],
          ['table_restaurant', 'Tables', branchId ? `/admin/branches/${branchId}/tables` : null, false],
          ['badge', 'Team', `/admin/staff?restaurantId=${id}`, false],
        ].map(([icon, label, to, active]) => (
          <Button
            key={label}
            onClick={() => to && navigate(to)}
            sx={{ flexDirection: 'column', gap: 0, minWidth: 48, minHeight: 48, color: active ? '#9B2F00' : 'text.secondary', fontWeight: active ? 800 : 400, fontSize: 10 }}
          >
            <Sym name={icon} size={22} />
            {label}
          </Button>
        ))}
      </Box>

      <Box component="footer" sx={{ bgcolor: '#FAF2EE', py: 2, display: { xs: 'none', md: 'block' } }}>
        <Container maxWidth="lg" sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="caption" fontSize={12} color="text.secondary">
            ● TablePulse OS v2.4 • Connected to Cloud KOT Engine
          </Typography>
          <Typography variant="caption" fontSize={12} color="text.secondary">
            Hardware Setup · UPI Soundbox Docs · FSSAI & Tax Compliance · © {new Date().getFullYear()} TablePulse
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
