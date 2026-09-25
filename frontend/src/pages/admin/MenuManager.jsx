import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import DishPhotoField from '../../components/DishPhotoField.jsx';
import RestoreIcon from '@mui/icons-material/Restore';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControl,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import VegMark from '../../components/VegMark.jsx';
import {
  createCategory,
  createItem,
  createModifierGroup,
  createModifierOption,
  deleteItem,
  deleteItemImage,
  deleteModifierGroup,
  deleteModifierOption,
  listCategories,
  listItems,
  listModifierGroups,
  restoreItem,
  setAvailability,
  setModifierOptionAvailability,
  updateItem,
  updateModifierGroup,
  updateModifierOption,
  uploadItemImage,
} from '../../services/menu.js';
import { getRestaurant, listBranches, listRestaurants } from '../../services/restaurant.js';

const EMPTY_DISH = {
  name: '', description: '', price: '', vegetarian: true, prep: '',
  hasSizes: false, sizeM: '', sizeL: '', categoryId: 'new', newCategory: '',
  available: true,
};

function elapsedShort(iso) {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ${min % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Sym({ name, size = 18 }) {
  return (
    <Box component="span" className="material-symbols-outlined" sx={{ fontSize: size, display: 'inline-flex' }}>
      {name}
    </Box>
  );
}

function catIcon(name = '') {
  const n = name.toLowerCase();
  if (/tandoor|kebab|grill|starter|appet/.test(n)) return 'outdoor_grill';
  if (/curr|gravy|dal|paneer|masala/.test(n)) return 'soup_kitchen';
  if (/biryani|rice|pulao|fried/.test(n)) return 'rice_bowl';
  if (/bread|roti|naan|paratha|kulcha/.test(n)) return 'bakery_dining';
  if (/dessert|mithai|sweet|ice|kulfi|cake/.test(n)) return 'icecream';
  if (/bever|drink|mocktail|coffee|tea|juice|shake|lassi/.test(n)) return 'local_bar';
  if (/chinese|noodle|momo|roll|frankie/.test(n)) return 'ramen_dining';
  if (/south|dosa|idli|uttapam/.test(n)) return 'breakfast_dining';
  if (/chaat|snack|tikki|pav|sandwich|burger|pizza|pasta/.test(n)) return 'fastfood';
  if (/egg|omelette/.test(n)) return 'egg';
  if (/salad|healthy|soup/.test(n)) return 'salad';
  if (/seafood|fish|prawn|chicken|mutton|meat/.test(n)) return 'kebab_dining';
  return 'restaurant_menu';
}

export default function MenuManager() {
  const { id: restaurantId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [rest, setRest] = useState(null);
  const [branches, setBranches] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [cats, setCats] = useState(null);
  const [activeCat, setActiveCat] = useState('all');
  const [allItems, setAllItems] = useState([]); // every item (bounded fan-out)
  const [catCounts, setCatCounts] = useState({});
  const [modInfo, setModInfo] = useState({}); // itemId -> { count, hasSize }
  const [modGroups, setModGroups] = useState([]);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const [catOpen, setCatOpen] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', description: '' });

  // Shared dish drawer (add + edit)
  const [drawer, setDrawer] = useState(null); // null | { mode: 'add' } | { mode: 'edit', item }
  const [dish, setDish] = useState(EMPTY_DISH);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoRemove, setPhotoRemove] = useState(false);
  const [editSizeRows, setEditSizeRows] = useState(null);

  const [deleteOpen, setDeleteOpen] = useState(null);
  const [modOpen, setModOpen] = useState(null);
  const [groupForm, setGroupForm] = useState({ name: '', required: false, maxSelections: 1, variantMode: false });
  const [optForm, setOptForm] = useState({ groupId: '', name: '', additionalPrice: 0, absPrice: '', defaultOption: false });
  const [editingGroup, setEditingGroup] = useState(null);
  const [editingOption, setEditingOption] = useState(null);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState('');
  const [diet, setDiet] = useState('all'); // all | veg | nonveg | soldout
  const [rushOnly, setRushOnly] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  };

  // Full catalog fan-out (bounded): counts + totals across categories.
  const loadCatalog = useCallback(async () => {
    const categories = (await listCategories(restaurantId)).data ?? [];
    setCats(categories);
    const per = await Promise.all(
      categories.map(async (c) => {
        const list = await listItems(c.id).catch(() => ({ data: [] }));
        return { cat: c, items: list.data ?? [] };
      }),
    );
    const counts = {};
    let all = [];
    for (const { cat, items: list } of per) {
      counts[cat.id] = list.length;
      all = all.concat(list.map((i) => ({ ...i, categoryId: cat.id, categoryName: cat.name })));
    }
    setCatCounts(counts);
    setAllItems(all);
    return { categories, all };
  }, [restaurantId]);

  // Modifier hints for the visible category only (bounded to ~60 items).
  const refreshModInfo = useCallback(
    async (all, catId) => {
      const visible = catId === 'all' ? all : all.filter((i) => i.categoryId === catId);
      const info = {};
      await Promise.all(
        visible.slice(0, 60).map(async (i) => {
          const g = await listModifierGroups(i.id).catch(() => ({ data: [] }));
          const groups = g.data ?? [];
          const size = groups.find((x) => x.required && x.maxSelections === 1 && (x.options ?? []).length > 1);
          info[i.id] = { count: groups.length, hasSize: !!size, sizeOptions: size ? (size.options ?? []).length : 0 };
        }),
      );
      setModInfo(info);
    },
    [],
  );

  useEffect(() => {
    // Outlet switch reuses this route — reset outlet-scoped UI state.
    setActiveCat('all');
    setQuery('');
    setDiet('all');
    setRushOnly(false);
    setDrawer(null);
    setModOpen(null);
    setDeleteOpen(null);
    Promise.all([
      getRestaurant(restaurantId).catch(() => null),
      listBranches(restaurantId).catch(() => ({ data: [] })),
      listRestaurants().catch(() => ({ data: [] })),
    ])
      .then(([r, b, o]) => {
        if (r) setRest(r.data);
        setBranches(b.data ?? []);
        setOutlets(o.data ?? []);
      })
      .catch((e) => setError(e.message));
    loadCatalog()
      .then(({ all }) => refreshModInfo(all, 'all'))
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  useEffect(() => {
    refreshModInfo(allItems, activeCat).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCat]);

  const catItems = useMemo(
    () => (activeCat === 'all' ? [...allItems] : allItems.filter((i) => i.categoryId === activeCat)),
    [allItems, activeCat],
  );

  const visibleItems = useMemo(() => {
    let list = [...catItems];
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((i) => `${i.name} ${i.description ?? ''}`.toLowerCase().includes(q));
    if (diet === 'veg') list = list.filter((i) => !!i.vegetarian);
    else if (diet === 'nonveg') list = list.filter((i) => !i.vegetarian);
    else if (diet === 'soldout') list = list.filter((i) => !i.available);
    if (rushOnly) list = list.filter((i) => !i.available);
    return list.sort((a, b) => Number(b.active ?? true) - Number(a.active ?? true));
  }, [catItems, query, diet, rushOnly]);

  const totalDishes = allItems.length;
  const soldOutCount = allItems.filter((i) => !i.available).length;
  const photoCount = allItems.filter((i) => i.imageUrl).length;
  const activeCatName = activeCat === 'all' ? 'All Dishes' : (cats ?? []).find((c) => c.id === activeCat)?.name ?? '…';
  const firstBranch = branches[0] ?? null;

  function previewFile(file) {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    if (!file) {
      setPhotoUrl(null);
      return;
    }
    setPhotoUrl(URL.createObjectURL(file));
  }

  function openAdd(prefillCat) {
    setDish({ ...EMPTY_DISH, categoryId: prefillCat && prefillCat !== 'all' ? prefillCat : cats?.[0]?.id ?? 'new', newCategory: '' });
    setPhotoFile(null);
    setPhotoUrl(null);
    setPhotoRemove(false);
    setEditSizeRows(null);
    setFormError(null);
    setDrawer({ mode: 'add' });
  }

  async function openEdit(item) {
    setDish({
      name: item.name ?? '',
      description: item.description ?? '',
      price: String(item.price ?? ''),
      vegetarian: !!item.vegetarian,
      prep: item.preparationTimeMinutes ? String(item.preparationTimeMinutes) : '',
      hasSizes: false,
      sizeM: '',
      sizeL: '',
      categoryId: item.categoryId ?? activeCat,
      newCategory: '',
      available: item.available ?? true,
    });
    setPhotoFile(null);
    setPhotoUrl(null);
    setPhotoRemove(false);
    setFormError(null);
    setDrawer({ mode: 'edit', item });
    try {
      const g = (await listModifierGroups(item.id)).data ?? [];
      const size = g.find((x) => x.required && x.maxSelections === 1);
      const base = Number(item.price ?? 0);
      setEditSizeRows(
        size
          ? (size.options ?? []).map((o) => ({ name: o.name, abs: base + Number(o.additionalPrice ?? 0), available: o.available }))
          : null,
      );
    } catch {
      setEditSizeRows(null);
    }
  }

  function closeDrawer() {
    setDrawer(null);
    setDish(EMPTY_DISH);
    setPhotoFile(null);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    setPhotoRemove(false);
    setEditSizeRows(null);
    setFormError(null);
  }

  async function persistDish({ andAnother }) {
    setFormError(null);
    const price = Number(dish.price);
    if (!dish.name.trim()) {
      setFormError('Dish name is required.');
      return;
    }
    if (!price && price !== 0) {
      setFormError('Base price is required.');
      return;
    }
    setSaving(true);
    try {
      if (drawer.mode === 'add') {
        let catId = dish.categoryId;
        if (!catId || catId === 'new') {
          if (!dish.newCategory.trim()) {
            setFormError('Create or pick a category first.');
            setSaving(false);
            return;
          }
          const c = await createCategory(restaurantId, { name: dish.newCategory.trim(), displayOrder: (cats ?? []).length });
          catId = c.data.id;
        }
        const base = Number(dish.price);
        if (dish.hasSizes) {
          const m = Number(dish.sizeM);
          const l = Number(dish.sizeL);
          if (!m || m < base || !l || l < base) {
            setFormError('Medium and Large prices must be numbers at or above the Small (base) price.');
            setSaving(false);
            return;
          }
        }
        const created = await createItem(catId, {
          name: dish.name.trim(),
          description: dish.description.trim() || undefined,
          price: base,
          vegetarian: !!dish.vegetarian,
          preparationTimeMinutes: dish.prep ? Number(dish.prep) : undefined,
          displayOrder: catCounts[catId] ?? 0,
        });
        if (dish.hasSizes) {
          const m = Number(dish.sizeM);
          const l = Number(dish.sizeL);
          const g = await createModifierGroup(created.data.id, {
            name: 'Size',
            required: true,
            minSelections: 1,
            maxSelections: 1,
            displayOrder: 0,
          });
          const gid = g.data.id;
          await createModifierOption(gid, { name: 'Small', additionalPrice: 0, defaultOption: true });
          await createModifierOption(gid, { name: 'Medium', additionalPrice: m - base });
          await createModifierOption(gid, { name: 'Large', additionalPrice: l - base });
        }
        if (photoFile) await uploadItemImage(created.data.id, photoFile);
        showToast(`"${dish.name.trim()}" published — live on QR in seconds.`);
      } else {
        const item = drawer.item;
        await updateItem(item.id, {
          name: dish.name.trim(),
          description: dish.description.trim() || null,
          price: Number(dish.price),
          vegetarian: !!dish.vegetarian,
          preparationTimeMinutes: dish.prep ? Number(dish.prep) : null,
        });
        if (!dish.available !== !item.available) {
          await setAvailability(item.id, !!dish.available);
        }
        if (photoRemove) {
          await deleteItemImage(item.id);
        } else if (photoFile) {
          await uploadItemImage(item.id, photoFile);
        }
        showToast(`"${dish.name.trim()}" saved.`);
      }
      await loadCatalog();
      if (andAnother) {
        const keepCat = dish.categoryId;
        setDish({ ...EMPTY_DISH, categoryId: keepCat, vegetarian: dish.vegetarian });
        setPhotoFile(null);
        if (photoUrl) URL.revokeObjectURL(photoUrl);
        setPhotoUrl(null);
        setPhotoRemove(false);
      } else {
        closeDrawer();
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onCreateCat(e) {
    e.preventDefault();
    setFormError(null);
    try {
      const r = await createCategory(restaurantId, { ...catForm, displayOrder: cats?.length ?? 0 });
      setCatOpen(false);
      setCatForm({ name: '', description: '' });
      await loadCatalog();
      setActiveCat(r.data.id);
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function onConfirmDelete() {
    if (!deleteOpen) return;
    try {
      await deleteItem(deleteOpen.id);
      setDeleteOpen(null);
      showToast('Item hidden from the customer menu (history kept).');
      await loadCatalog();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onRestore(item) {
    try {
      await restoreItem(item.id);
      showToast(`"${item.name}" restored.`);
      await loadCatalog();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onToggle(item, v) {
    try {
      const res = await setAvailability(item.id, v);
      const row = res.data ?? { available: v };
      setAllItems((list) => (list ?? []).map((i) => (i.id === item.id ? { ...i, ...row } : i)));
      showToast(v ? `"${item.name}" back in stock.` : `"${item.name}" marked sold out (86'd).`);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (!modOpen) {
      setModGroups([]);
      return;
    }
    listModifierGroups(modOpen.id)
      .then((r) => setModGroups(r.data ?? []))
      .catch((e) => setError(e.message));
  }, [modOpen]);

  async function onCreateGroup(e) {
    e.preventDefault();
    setFormError(null);
    try {
      const variant = !!groupForm.variantMode;
      await createModifierGroup(modOpen.id, {
        name: groupForm.name,
        required: variant ? true : groupForm.required,
        minSelections: variant ? 1 : (groupForm.required ? 1 : 0),
        maxSelections: variant ? 1 : (Number(groupForm.maxSelections) || 1),
        displayOrder: modGroups.length,
      });
      setGroupForm({ name: '', required: false, maxSelections: 1, variantMode: false });
      listModifierGroups(modOpen.id).then((r) => setModGroups(r.data ?? []));
    } catch (err) {
      setFormError(err.message);
    }
  }

  const refreshMods = () =>
    listModifierGroups(modOpen.id).then((r) => setModGroups(r.data ?? [])).catch((e) => setError(e.message));

  async function onCreateOption(e) {
    e.preventDefault();
    setFormError(null);
    try {
      const group = modGroups.find((g) => g.id === optForm.groupId);
      void group;
      const base = Number(modOpen?.price ?? 0);
      let delta = Number(optForm.additionalPrice) || 0;
      if (optForm.absPrice !== '' && optForm.absPrice != null) {
        const abs = Number(optForm.absPrice);
        if (!abs || abs < base) {
          setFormError(`Absolute price must be at or above base ₹${base.toFixed(2)} (Small).`);
          return;
        }
        delta = abs - base;
      }
      await createModifierOption(optForm.groupId, {
        name: optForm.name,
        additionalPrice: delta,
        defaultOption: !!optForm.defaultOption,
      });
      setOptForm({ groupId: '', name: '', additionalPrice: 0, absPrice: '', defaultOption: false });
      refreshMods();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function onDeleteGroup(id) {
    try {
      await deleteModifierGroup(id);
      refreshMods();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onDeleteOption(id) {
    try {
      await deleteModifierOption(id);
      refreshMods();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onToggleOption(id, v) {
    try {
      await setModifierOptionAvailability(id, v);
      refreshMods();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onSaveGroupEdit(e) {
    e.preventDefault();
    if (!editingGroup) return;
    try {
      await updateModifierGroup(editingGroup.id, {
        name: editingGroup.name,
        maxSelections: Number(editingGroup.maxSelections) || 1,
      });
      setEditingGroup(null);
      refreshMods();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function onSaveOptionEdit(e) {
    e.preventDefault();
    if (!editingOption) return;
    try {
      const base = Number(modOpen?.price ?? 0);
      const abs = Number(editingOption.absPrice);
      const payload = { name: editingOption.name };
      if (editingOption.absPrice !== '' && editingOption.absPrice != null) {
        if (!abs || abs < base) {
          setFormError(`Absolute price must be at or above base ₹${base.toFixed(2)}.`);
          return;
        }
        payload.additionalPrice = abs - base;
      }
      await updateModifierOption(editingOption.id, payload);
      setEditingOption(null);
      refreshMods();
    } catch (err) {
      setFormError(err.message);
    }
  }

  const descLen = dish.description.trim().length;
  const drawerPhoto = photoUrl ?? (drawer?.mode === 'edit' && !photoRemove ? drawer.item?.imageUrl ?? null : null);

  return (
    <Box sx={{ pb: { xs: '64px', md: 0 } }}>
      {/* breadcrumb */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        <Button component={RouterLink} to="/admin/restaurants" startIcon={<ArrowBackIcon />} size="small" sx={{ bgcolor: '#fff', borderRadius: 2 }}>
          All Restaurants
        </Button>
        {outlets.length > 1 ? (
          <FormControl size="small" sx={{ minWidth: 190, bgcolor: '#fff', borderRadius: 2, '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 12, fontWeight: 700 } }}>
            <Select
              value={restaurantId}
              onChange={(e) => navigate(`/admin/restaurants/${e.target.value}/menu`)}
              aria-label="Switch restaurant menu"
            >
              {outlets.map((o) => (
                <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          <Typography variant="body2" fontWeight={600} fontSize={12} color="text.secondary" noWrap>
            {rest?.name ?? '…'}
          </Typography>
        )}
        <Typography variant="body2" fontWeight={600} fontSize={12} color="text.secondary" noWrap>
          <strong style={{ color: '#1E1B19' }}>› Menu Manager</strong>
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Chip
          size="small"
          icon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#00632B', ml: 1 }} />}
          label="Kitchen KDS Connected"
          component={RouterLink}
          to="/kitchen"
          clickable
          sx={{ bgcolor: 'rgba(17,126,59,.1)', color: '#00632B', fontWeight: 800, fontSize: 10, textDecoration: 'none' }}
        />
      </Box>

      {/* header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} fontSize={28}>
            Menu & Catalog Manager
          </Typography>
          <Typography variant="body2" fontSize={12} color="text.secondary" sx={{ mt: 0.5 }}>
            {totalDishes} Dishes across {(cats ?? []).length} Sections · Instant digital QR & billing sync active
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', bgcolor: '#fff', px: 1.75, py: 1, borderRadius: 2, border: 1, borderColor: 'divider' }}>
            <Sym name="bolt" size={18} />
            <Box sx={{ lineHeight: 1.2 }}>
              <Typography variant="body2" fontWeight={800} fontSize={12}>Rush Hour 86 Mode</Typography>
              <Typography variant="caption" fontSize={10} color="text.secondary">Quick stock cut</Typography>
            </Box>
            <Switch size="small" checked={rushOnly} onChange={(_, v) => setRushOnly(v)} slotProps={{ input: { 'aria-label': 'rush 86 filter' } }} />
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openAdd(activeCat)} sx={{ borderRadius: 2, fontWeight: 800, height: 48, backgroundImage: 'linear-gradient(90deg, #C2410C, #9B2F00)' }}>
            + Add New Dish
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {rushOnly && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setRushOnly(false)}>
          Rush filter on — showing sold-out items only. Toggle off to see the full menu.
        </Alert>
      )}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', xl: '4fr 8fr' }, alignItems: 'start' }}>
        {/* categories rail */}
        <Box sx={{ display: 'grid', gap: 2, alignContent: 'start' }}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="h6" fontWeight={800} fontSize={18}>
                  Categories ({(cats ?? []).length})
                </Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={() => { setFormError(null); setCatOpen(true); }} sx={{ fontWeight: 800, color: '#9B2F00' }}>
                  New Category
                </Button>
              </Box>
              {cats === null ? (
                <Typography variant="body2" color="text.secondary">Loading categories…</Typography>
              ) : (
                <Box sx={{ display: 'grid', gap: 0.75 }}>
                  <Box
                    onClick={() => setActiveCat('all')}
                    sx={{
                      p: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      cursor: 'pointer', bgcolor: activeCat === 'all' ? '#FAF2EE' : 'transparent',
                      '&:hover': { bgcolor: '#FAF2EE' },
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
                      <Sym name="fastfood" size={18} />
                      <Typography variant="body2" fontWeight={600} fontSize={14}>All Dishes</Typography>
                    </Box>
                    <Chip size="small" label={totalDishes} sx={{ fontSize: 10 }} />
                  </Box>
                  {(cats ?? []).map((c) => {
                    const active = activeCat === c.id;
                    return (
                      <Box
                        key={c.id}
                        onClick={() => setActiveCat(c.id)}
                        sx={{
                          p: active ? 1.75 : 1.5,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          bgcolor: active ? '#C2410C' : '#FAF2EE',
                          color: active ? '#fff' : 'inherit',
                          boxShadow: active ? 2 : 0,
                          '&:hover': { bgcolor: active ? '#9B2F00' : '#F4ECE8' },
                        }}
                      >
                        <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', minWidth: 0 }}>
                          <Sym name={catIcon(c.name)} size={active ? 20 : 18} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={800} fontSize={14} noWrap>{c.name}</Typography>
                            {active && (
                              <Typography variant="caption" fontSize={10} sx={{ color: '#FFE8D5' }}>
                                {(catCounts[c.id] ?? 0)} items · tap to manage
                              </Typography>
                            )}
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexShrink: 0 }}>
                          <Chip size="small" label={catCounts[c.id] ?? 0} sx={{ fontSize: 10, fontWeight: 800, bgcolor: active ? 'rgba(255,255,255,.2)' : undefined, color: active ? '#fff' : undefined }} />
                          {active && <Sym name="chevron_right" size={18} />}
                        </Box>
                      </Box>
                    );
                  })}
                  {(cats ?? []).length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No categories yet — create one to start the menu.
                    </Typography>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="body2" fontWeight={800} fontSize={14} sx={{ mb: 1.5 }}>
                Quick Catalog Health
              </Typography>
              <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: '1fr 1fr' }}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: soldOutCount > 0 ? 'rgba(186,26,26,.07)' : '#FAF2EE' }}>
                  <Typography variant="caption" fontSize={10} color={soldOutCount > 0 ? '#93000A' : 'text.secondary'} fontWeight={700}>
                    86&apos;d Out of Stock
                  </Typography>
                  <Typography variant="h6" fontWeight={800} fontSize={18} sx={{ color: soldOutCount > 0 ? '#BA1A1A' : 'inherit' }}>
                    {soldOutCount} Items
                  </Typography>
                  <Typography variant="caption" fontSize={10} color="text.secondary">
                    {soldOutCount > 0 ? 'Requires restock' : 'All stocked'}
                  </Typography>
                </Box>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#FAF2EE' }}>
                  <Typography variant="caption" fontSize={10} color="text.secondary" fontWeight={700}>
                    With Photos
                  </Typography>
                  <Typography variant="h6" fontWeight={800} fontSize={18}>
                    {photoCount} Items
                  </Typography>
                  <Typography variant="caption" fontSize={10} sx={{ color: '#00632B' }}>
                    of {totalDishes} live
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* items column */}
        <Box sx={{ display: 'grid', gap: 2, alignContent: 'start', minWidth: 0 }}>
          {/* mobile stats */}
          <Box sx={{ display: { xs: 'grid', md: 'none' }, gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, bgcolor: '#fff', borderRadius: 2, border: 1, borderColor: 'divider', p: 1.5 }}>
            {[
              [String(totalDishes), 'Dishes'],
              [String((cats ?? []).length), 'Sections'],
              [`${soldOutCount}`, "86'd Out"],
            ].map(([v, l]) => (
              <Box key={l} sx={{ textAlign: 'center' }}>
                <Typography variant="h6" fontWeight={800} fontSize={18}>{v}</Typography>
                <Typography variant="caption" fontSize={10} color="text.secondary">{l}</Typography>
              </Box>
            ))}
            <Box
              onClick={() => setRushOnly((v) => !v)}
              sx={{ textAlign: 'center', cursor: 'pointer', borderRadius: 2, bgcolor: rushOnly ? '#FFDAD6' : 'transparent', py: 0.5 }}
            >
              <Sym name="bolt" size={20} />
              <Typography variant="caption" fontSize={10} fontWeight={800} sx={{ color: '#9B2F00', display: 'block' }}>
                Rush 86
              </Typography>
            </Box>
          </Box>

          {/* toolbar */}
          <Card sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: 1.75, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField
                size="small"
                placeholder={`Search dishes in ${activeCatName}...`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                sx={{ flexGrow: 1, minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FAF2EE' } }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
              <Box className="no-scrollbar" sx={{ display: 'flex', gap: 0.75, overflowX: 'auto' }}>
                {[
                  ['all', `All (${catItems.length})`, null],
                  ['veg', 'Veg Only', true],
                  ['nonveg', 'Non-Veg', false],
                ].map(([v, l, veg]) => (
                  <Chip
                    key={v}
                    clickable
                    onClick={() => setDiet(v)}
                    label={l}
                    icon={veg === null ? undefined : <VegMark veg={veg} size={12} />}
                    sx={diet === v
                      ? { bgcolor: '#9B2F00', color: '#fff', fontWeight: 800, fontSize: 12 }
                      : { bgcolor: '#F4ECE8', fontWeight: 600, fontSize: 12 }}
                  />
                ))}
                <Chip
                  clickable
                  onClick={() => setDiet(diet === 'soldout' ? 'all' : 'soldout')}
                  label={`86'd (${catItems.filter((i) => !i.available).length})`}
                  sx={diet === 'soldout'
                    ? { bgcolor: '#BA1A1A', color: '#fff', fontWeight: 800, fontSize: 12 }
                    : { bgcolor: 'rgba(186,26,26,.08)', color: '#93000A', fontWeight: 800, fontSize: 12 }}
                />
              </Box>
            </CardContent>
          </Card>

          {/* item cards */}
          {visibleItems.map((i) => {
            const inactive = !(i.active ?? true);
            const info = modInfo[i.id];
            return (
              <Card
                key={i.id}
                sx={{
                  borderRadius: 2,
                  opacity: !i.available || inactive ? 0.85 : 1,
                  ...(inactive || !i.available ? {} : {}),
                }}
              >
                <CardContent sx={{ p: 2, display: 'flex', gap: 1.75, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
                  <Box sx={{ display: 'flex', gap: 1.75, flexGrow: 1, minWidth: 0 }}>
                    <Box
                      onClick={() => openEdit(i)}
                      title={`Edit ${i.name}`}
                      sx={{
                        width: { xs: 80, sm: 112 },
                        height: { xs: 80, sm: 112 },
                        borderRadius: 2,
                        overflow: 'hidden',
                        bgcolor: '#F4ECE8',
                        border: 1,
                        borderColor: 'divider',
                        flexShrink: 0,
                        cursor: 'pointer',
                        ...(inactive || !i.available ? { filter: 'grayscale(.5)', opacity: 0.8 } : {}),
                      }}
                    >
                      {i.imageUrl ? (
                        <Box component="img" src={i.imageUrl} alt={i.name} loading="lazy"
                          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <Box sx={{
                          width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 28, fontWeight: 800, color: '#9B2F00', background: 'linear-gradient(135deg, #FFF5ED, #FFE8D5)',
                        }}>
                          {i.name?.[0]?.toUpperCase()}
                        </Box>
                      )}
                    </Box>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                        <VegMark veg={!!i.vegetarian} size={14} />
                        <Typography variant="h6" fontWeight={800} fontSize={18}>
                          {i.name}
                        </Typography>
                        {!i.available && !inactive && (
                          <Chip size="small" label="86'd (Sold Out)" sx={{ bgcolor: '#FFDAD6', color: '#93000A', fontWeight: 800, fontSize: 10, height: 22 }} />
                        )}
                        {inactive && <Chip size="small" label="Hidden" sx={{ height: 22, fontSize: 10 }} />}
                      </Box>
                      {i.description && (
                        <Typography variant="body2" fontSize={12} color="text.secondary" className="clamp-2" sx={{ mt: 0.25 }}>
                          {i.description}
                        </Typography>
                      )}
                      <Typography variant="caption" fontSize={10} color="text.secondary" sx={{ display: 'flex', gap: 1.5, mt: 0.75, flexWrap: 'wrap' }}>
                        {i.preparationTimeMinutes ? <span>~{i.preparationTimeMinutes} min</span> : null}
                        {info?.hasSize ? <span>{info.sizeOptions} sizes</span> : info?.count > 0 ? <span>Customisable</span> : null}
                        {i.lastChangedBy ? (
                          <span>{!i.available ? '🔴 Sold out' : '🟢 Restocked'} · by {i.lastChangedBy}{i.updatedAt ? ` · ${elapsedShort(i.updatedAt)}` : ''}</span>
                        ) : null}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
                    <Box sx={{ minWidth: 64 }}>
                      <Typography variant="h6" fontWeight={800} fontSize={20} sx={{ opacity: inactive || !i.available ? 0.7 : 1 }}>
                        ₹{Number(i.price).toFixed(2)}
                      </Typography>
                      <Typography variant="caption" fontSize={10} color="text.secondary">Base Price</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
                      <Switch
                        size="small"
                        checked={!!i.available}
                        disabled={inactive}
                        onChange={(_, v) => onToggle(i, v)}
                        slotProps={{ input: { 'aria-label': `availability of ${i.name}` } }}
                      />
                      <Typography variant="caption" fontSize={10} fontWeight={800} sx={{ color: i.available ? '#00632B' : '#BA1A1A' }}>
                        {i.available ? 'In Stock' : 'Sold Out'}
                      </Typography>
                    </Box>
                    {!inactive ? (
                      <>
                        <Tooltip title="Edit item">
                          <IconButton size="small" onClick={() => openEdit(i)} aria-label={`edit ${i.name}`} sx={{ bgcolor: '#F4ECE8' }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Hide from customer (keeps order history)">
                          <IconButton size="small" onClick={() => setDeleteOpen(i)} aria-label={`delete ${i.name}`}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    ) : (
                      <Button size="small" startIcon={<RestoreIcon />} onClick={() => onRestore(i)} sx={{ borderRadius: 2 }}>
                        Restore
                      </Button>
                    )}
                  </Box>
                </CardContent>
                <Box sx={{ px: 2, pb: 1.5, display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Button size="small" variant="text" onClick={() => { setModOpen(i); setFormError(null); }} sx={{ fontWeight: 700, color: '#9B2F00', p: 0 }}>
                    Modifiers {info?.count > 0 ? `(${info.count})` : ''} →
                  </Button>
                  {!i.available && !inactive && (
                    <Button size="small" variant="contained" onClick={() => onToggle(i, true)} sx={{ ml: 'auto', borderRadius: 2, bgcolor: '#00632B' }}>
                      Restock
                    </Button>
                  )}
                </Box>
              </Card>
            );
          })}
          {cats === null ? (
            <Typography variant="body2" color="text.secondary">Loading items…</Typography>
          ) : visibleItems.length === 0 ? (
            <EmptyStateFallback query={query} catName={activeCatName} onAdd={() => openAdd(activeCat)} />
          ) : null}
        </Box>
      </Box>

      {/* sticky mobile bottom bar */}
      <Box
        sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed',
          bottom: 64,
          left: 12,
          right: 12,
          zIndex: 1000,
          gap: 1,
          p: 0.75,
          borderRadius: 2,
          bgcolor: 'rgba(30,27,23,.95)',
          boxShadow: 4,
        }}
      >
        <Button fullWidth variant="contained" startIcon={<AddIcon />} onClick={() => openAdd(activeCat)}
          sx={{ borderRadius: 2, fontWeight: 800, backgroundImage: 'linear-gradient(90deg, #C2410C, #9B2F00)' }}>
          + Add Dish{activeCat !== 'all' ? ` to ${activeCatName}` : ''}
        </Button>
      </Box>

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
          bgcolor: 'rgba(255,248,245,0.95)',
          backdropFilter: 'blur(20px)',
          justifyContent: 'space-around',
          alignItems: 'center',
          height: 64,
        }}
      >
        {[
          ['table_restaurant', 'Floor', firstBranch ? `/admin/branches/${firstBranch.id}/tables` : `/admin/restaurants/${restaurantId}`],
          ['receipt_long', 'Orders', '/kitchen'],
          ['restaurant_menu', 'Menu', null],
          ['insights', 'Analytics', '/admin/revenue'],
          ['store', 'Restaurant', `/admin/restaurants/${restaurantId}`],
        ].map(([icon, label, to]) => (
          <Button
            key={label}
            component={to ? RouterLink : 'button'}
            to={to ?? undefined}
            sx={{ flexDirection: 'column', gap: 0, minWidth: 56, minHeight: 44, color: to ? 'text.secondary' : '#9B2F00', fontWeight: to ? 400 : 800, fontSize: 10 }}
          >
            <Sym name={icon} size={22} />
            {label}
          </Button>
        ))}
      </Box>

      {/* category dialog */}
      <Dialog open={catOpen} onClose={() => setCatOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New category</DialogTitle>
        <Box component="form" onSubmit={onCreateCat}>
          <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
            <TextField label="Name" required value={catForm.name} onChange={(e) => setCatForm((s) => ({ ...s, name: e.target.value }))} placeholder="Starters" />
            <TextField label="Description" value={catForm.description} onChange={(e) => setCatForm((s) => ({ ...s, description: e.target.value }))} />
            {formError && <Alert severity="error">{formError}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCatOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Create</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* dish drawer (add + edit) */}
      <Drawer
        anchor={isMobile ? 'bottom' : 'right'}
        open={!!drawer}
        onClose={closeDrawer}
        PaperProps={{
          sx: isMobile
            ? { height: '92vh', borderTopLeftRadius: 28, borderTopRightRadius: 28 }
            : { width: 640, maxWidth: '100vw' },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ p: { xs: 2.5, sm: 3 }, pb: 2, bgcolor: '#FAF2EE', flexShrink: 0 }}>
            {isMobile && <Box sx={{ width: 48, height: 6, borderRadius: 999, bgcolor: '#E1BFB5', mx: 'auto', mb: 1.5 }} />}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start', mb: 0.5 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip size="small" label="Dish Creator Engine" sx={{ bgcolor: '#FFDBD0', color: '#9B2F00', fontWeight: 800, fontSize: 10 }} />
                <Typography variant="caption" fontSize={10} color="text.secondary">
                  {(cats ?? []).find((c) => c.id === (dish.categoryId !== 'new' ? dish.categoryId : null))?.name ?? activeCatName}
                </Typography>
              </Box>
              <IconButton size="small" onClick={closeDrawer} aria-label="Close dish editor" sx={{ bgcolor: '#fff' }}>
                <Sym name="close" size={20} />
              </IconButton>
            </Box>
            <Typography variant="h5" fontWeight={800} fontSize={28}>
              {drawer?.mode === 'edit' ? 'Edit Dish' : 'Add New Dish'}
            </Typography>
            <Typography variant="body2" fontSize={12} color="text.secondary">
              Configure portion pricing, dietary tags and kitchen routing.
            </Typography>
            <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: '#fff', display: 'flex', gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <Avatar sx={{ bgcolor: 'rgba(17,126,59,.12)', color: '#00632B', borderRadius: 2, width: 32, height: 32 }}>
                  <Sym name="bolt" size={18} />
                </Avatar>
                <Box>
                  <Typography variant="body2" fontWeight={800} fontSize={14}>Active in Menu</Typography>
                  <Typography variant="caption" fontSize={10} sx={{ color: '#00632B' }}>Instant QR Menu & POS Sync enabled</Typography>
                </Box>
              </Box>
              <Switch checked={!!dish.available} onChange={(_, v) => setDish((d) => ({ ...d, available: v }))} slotProps={{ input: { 'aria-label': 'active in menu' } }} />
            </Box>
          </Box>

          <Box
            component="form"
            id="dish-drawer-form"
            onSubmit={(e) => {
              e.preventDefault();
              persistDish({ andAnother: false });
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') persistDish({ andAnother: false });
            }}
            sx={{ flexGrow: 1, overflowY: 'auto', p: { xs: 2.5, sm: 3 }, display: 'grid', gap: 3, alignContent: 'start' }}
          >
            {/* 1 General */}
            <Box sx={{ display: 'grid', gap: 1.75 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body1" fontWeight={800} fontSize={16} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: '#C2410C', color: '#fff', width: 24, height: 24, fontSize: 12, fontWeight: 800 }}>1</Avatar>
                  General Information
                </Typography>
                <Typography variant="caption" fontSize={10} fontWeight={800} sx={{ color: '#9B2F00' }}>* Required Fields</Typography>
              </Box>
              <Box>
                <Typography variant="body2" fontWeight={700} fontSize={14} sx={{ mb: 0.75 }}>
                  Dish Name <span style={{ color: '#9B2F00' }}>*</span>
                </Typography>
                <TextField
                  fullWidth
                  required
                  value={dish.name}
                  onChange={(e) => setDish((d) => ({ ...d, name: e.target.value }))}
                  placeholder="e.g. Murgh Malai Chaap / Paneer Tikka Angara"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FAF2EE', height: 48 } }}
                  InputProps={{
                    endAdornment: dish.name.trim().length >= 2 ? (
                      <InputAdornment position="end"><Sym name="check_circle" size={18} /></InputAdornment>
                    ) : null,
                  }}
                />
              </Box>
              <Box>
                <Typography variant="body2" fontWeight={700} fontSize={14} sx={{ mb: 0.75 }}>
                  Category Placement <span style={{ color: '#9B2F00' }}>*</span>
                </Typography>
                {drawer?.mode === 'edit' ? (
                  <TextField
                    fullWidth
                    value={(cats ?? []).find((c) => c.id === dish.categoryId)?.name ?? activeCatName}
                    InputProps={{ readOnly: true }}
                    helperText="Category can't be moved after creation — recreate the dish to move it."
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FAF2EE', height: 48 } }}
                  />
                ) : (
                  <TextField
                    select
                    fullWidth
                    value={dish.categoryId}
                    onChange={(e) => setDish((d) => ({ ...d, categoryId: e.target.value, newCategory: '' }))}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FAF2EE', height: 48 } }}
                  >
                    {(cats ?? []).map((c) => (
                      <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                    ))}
                    <MenuItem value="new">+ New category…</MenuItem>
                  </TextField>
                )}
              </Box>
              {dish.categoryId === 'new' && (
                <TextField
                  label="New category name"
                  required
                  value={dish.newCategory}
                  onChange={(e) => setDish((d) => ({ ...d, newCategory: e.target.value }))}
                  placeholder="Starters & Tandoor"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              )}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography variant="body2" fontWeight={700} fontSize={14}>Short Description for Diner QR Menu</Typography>
                  <Typography variant="caption" fontSize={10} color="text.secondary">{descLen} / 160 chars</Typography>
                </Box>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  value={dish.description}
                  onChange={(e) => setDish((d) => ({ ...d, description: e.target.value.slice(0, 160) }))}
                  placeholder="Tender, juicy, charred over glowing charcoal…"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FAF2EE' } }}
                />
              </Box>
              <Box>
                <Typography variant="body2" fontWeight={700} fontSize={14} sx={{ mb: 0.75 }}>Dish Visual Artwork</Typography>
                <DishPhotoField
                  previewUrl={drawerPhoto}
                  placeholder={dish.name?.[0]?.toUpperCase()}
                  onPick={(f) => { setPhotoFile(f); setPhotoRemove(false); previewFile(f); }}
                  onRemove={() => {
                    setPhotoFile(null);
                    previewFile(null);
                    if (drawer?.mode === 'edit') setPhotoRemove(true);
                  }}
                />
              </Box>
            </Box>

            {/* 2 Dietary */}
            <Box sx={{ display: 'grid', gap: 1.5 }}>
              <Typography variant="body1" fontWeight={800} fontSize={16} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Avatar sx={{ bgcolor: '#C2410C', color: '#fff', width: 24, height: 24, fontSize: 12, fontWeight: 800 }}>2</Avatar>
                Dietary Classification
              </Typography>
              <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: '1fr 1fr' }}>
                {[
                  ['veg', 'Veg', true],
                  ['nonveg', 'Non-Veg', false],
                ].map(([v, l, veg]) => (
                  <Box
                    key={v}
                    onClick={() => setDish((d) => ({ ...d, vegetarian: veg }))}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: (dish.vegetarian === veg) ? '#fff' : '#FAF2EE',
                      border: 2,
                      borderColor: (dish.vegetarian === veg) ? '#9B2F00' : 'transparent',
                      boxShadow: (dish.vegetarian === veg) ? 1 : 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 0.75,
                      cursor: 'pointer',
                    }}
                  >
                    <VegMark veg={veg} size={16} />
                    <Typography variant="body2" fontWeight={800} fontSize={14} sx={{ color: (dish.vegetarian === veg) ? '#9B2F00' : 'inherit' }}>
                      {l}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* 3 Pricing */}
            <Box sx={{ display: 'grid', gap: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body1" fontWeight={800} fontSize={16} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: '#C2410C', color: '#fff', width: 24, height: 24, fontSize: 12, fontWeight: 800 }}>3</Avatar>
                  Pricing & Tax
                </Typography>
                {drawer?.mode === 'add' && (
                  <Box sx={{ display: 'flex', p: 0.5, borderRadius: 2, bgcolor: '#F4ECE8' }}>
                    {[['single', 'Single Price'], ['portion', 'Portion Sizes']].map(([v, l]) => (
                      <Button
                        key={v}
                        size="small"
                        onClick={() => setDish((d) => ({ ...d, hasSizes: v === 'portion' }))}
                        sx={{
                          borderRadius: 1.5, fontSize: 10, fontWeight: 800,
                          ...(dish.hasSizes === (v === 'portion') ? { bgcolor: '#fff', color: '#9B2F00', boxShadow: 1 } : { color: 'text.secondary' }),
                        }}
                      >
                        {l}
                      </Button>
                    ))}
                  </Box>
                )}
              </Box>
              <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                <TextField
                  label={dish.hasSizes && drawer?.mode === 'add' ? 'Small price ₹ *' : 'Price ₹ *'}
                  required
                  type="number"
                  value={dish.price}
                  onChange={(e) => setDish((d) => ({ ...d, price: e.target.value }))}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FAF2EE', height: 48 } }}
                />
                <TextField
                  label="Prep min"
                  type="number"
                  value={dish.prep}
                  onChange={(e) => setDish((d) => ({ ...d, prep: e.target.value }))}
                  placeholder="15"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FAF2EE', height: 48 } }}
                />
              </Box>
              {drawer?.mode === 'add' && dish.hasSizes && (
                <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: '1fr 1fr' }}>
                  <TextField label="Medium price ₹ *" required type="number" value={dish.sizeM}
                    onChange={(e) => setDish((d) => ({ ...d, sizeM: e.target.value }))}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FAF2EE' } }} />
                  <TextField label="Large price ₹ *" required type="number" value={dish.sizeL}
                    onChange={(e) => setDish((d) => ({ ...d, sizeL: e.target.value }))}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FAF2EE' } }} />
                </Box>
              )}
              {drawer?.mode === 'edit' && editSizeRows && (
                <Box sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: '#FAF2EE' }}>
                  {editSizeRows.map((r) => (
                    <Box key={r.name} sx={{ display: 'flex', justifyContent: 'space-between', px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
                      <Typography variant="body2" fontWeight={800} fontSize={14}>{r.name}</Typography>
                      <Typography variant="body2" fontWeight={800} fontSize={14}>₹{Number(r.abs).toFixed(2)}</Typography>
                    </Box>
                  ))}
                  <Button size="small" sx={{ m: 1, fontWeight: 700, color: '#9B2F00' }}
                    onClick={() => { const it = drawer.item; closeDrawer(); setModOpen(it); }}>
                    Manage sizes in Modifiers →
                  </Button>
                </Box>
              )}
              <Typography variant="caption" fontSize={10} color="text.secondary">
                {rest ? `${rest.taxPercentage}% Restaurant GST applies from restaurant settings.` : 'GST applies from restaurant settings.'} Base price = Small when portions are on.
              </Typography>
            </Box>

            {/* 4 Kitchen */}
            <Box sx={{ display: 'grid', gap: 1.5 }}>
              <Typography variant="body1" fontWeight={800} fontSize={16} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Avatar sx={{ bgcolor: '#C2410C', color: '#fff', width: 24, height: 24, fontSize: 12, fontWeight: 800 }}>4</Avatar>
                Kitchen Prep Time
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Button variant="outlined" onClick={() => setDish((d) => ({ ...d, prep: String(Math.max(0, (Number(d.prep) || 0) - 1)) }))} sx={{ minWidth: 44, height: 44, borderRadius: 2, fontWeight: 800 }}>
                  −
                </Button>
                <TextField
                  value={dish.prep ? `${dish.prep} min` : '—'}
                  InputProps={{ readOnly: true }}
                  sx={{ flexGrow: 1, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FAF2EE' }, '& input': { textAlign: 'center', fontWeight: 800 } }}
                />
                <Button variant="outlined" onClick={() => setDish((d) => ({ ...d, prep: String((Number(d.prep) || 0) + 1) }))} sx={{ minWidth: 44, height: 44, borderRadius: 2, fontWeight: 800 }}>
                  +
                </Button>
              </Box>
            </Box>

            {/* 5 Modifiers */}
            <Box sx={{ display: 'grid', gap: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body1" fontWeight={800} fontSize={16} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: '#C2410C', color: '#fff', width: 24, height: 24, fontSize: 12, fontWeight: 800 }}>5</Avatar>
                  Customization & Add-ons
                </Typography>
                {drawer?.mode === 'edit' && (
                  <Button size="small" sx={{ fontWeight: 800, color: '#9B2F00' }}
                    onClick={() => { const it = drawer.item; closeDrawer(); setModOpen(it); }}>
                    Open Modifiers →
                  </Button>
                )}
              </Box>
              <Typography variant="body2" fontSize={12} color="text.secondary">
                {drawer?.mode === 'add'
                  ? 'Save the dish first — modifier groups (accompaniments, dips, sizes) attach right after.'
                  : 'Groups, options, prices and 86 toggles live in the Modifiers dialog.'}
              </Typography>
            </Box>

            {formError && <Alert severity="error">{formError}</Alert>}
          </Box>

          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: '#fff', display: 'flex', gap: 1, flexShrink: 0 }}>
            <Button onClick={closeDrawer} sx={{ borderRadius: 2, color: 'text.secondary' }}>
              Discard
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            {drawer?.mode === 'add' && (
              <Button variant="outlined" disabled={saving} onClick={() => persistDish({ andAnother: true })} sx={{ borderRadius: 2, fontWeight: 700 }}>
                Save & Add Another
              </Button>
            )}
            <Button variant="contained" disabled={saving} startIcon={<Sym name="bolt" size={18} />} onClick={() => persistDish({ andAnother: false })}
              sx={{ borderRadius: 2, fontWeight: 800, backgroundImage: 'linear-gradient(90deg, #9B2F00, #C2410C)' }}>
              {saving ? 'Publishing…' : drawer?.mode === 'edit' ? 'Save Dish' : 'Save & Publish Dish'}
            </Button>
          </Box>
        </Box>
      </Drawer>

      {/* delete confirm */}
      <Dialog open={!!deleteOpen} onClose={() => setDeleteOpen(null)} fullWidth maxWidth="xs">
        <DialogTitle>Hide “{deleteOpen?.name}”?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            It will disappear from the customer menu immediately, but past orders keep it for history.
            You can restore it anytime.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={onConfirmDelete}>Hide item</Button>
        </DialogActions>
      </Dialog>

      {/* modifiers dialog (full CRUD preserved, Stitch tokens) */}
      <Dialog open={!!modOpen} onClose={() => setModOpen(null)} fullWidth maxWidth="sm">
        <DialogTitle>Modifiers — {modOpen?.name} (base ₹{Number(modOpen?.price ?? 0).toFixed(2)})</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
          {modGroups.map((g) => {
            const isVariant = g.required && g.maxSelections === 1;
            const base = Number(modOpen?.price ?? 0);
            return (
              <Box key={g.id} sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: '#FAF2EE' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="subtitle2" fontWeight={800} sx={{ flexGrow: 1 }}>
                    {g.name} {g.required && <Chip size="small" label="Required" color="primary" sx={{ ml: 0.5 }} />}
                    {isVariant && <Chip size="small" label="Sizes" color="secondary" sx={{ ml: 0.5 }} />}
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      pick up to {g.maxSelections}
                    </Typography>
                  </Typography>
                  <Tooltip title="Delete group"><IconButton size="small" onClick={() => onDeleteGroup(g.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.75 }}>
                  {g.options.map((o) => {
                    const abs = base + Number(o.additionalPrice ?? 0);
                    return (
                      <Chip
                        key={o.id}
                        size="small"
                        variant={o.available ? 'outlined' : 'filled'}
                        color={o.available ? 'default' : 'warning'}
                        label={`${o.name} · ₹${abs.toFixed(2)}${o.defaultOption ? ' ★' : ''}${o.available ? '' : ' (sold out)'}`}
                        onDelete={() => onDeleteOption(o.id)}
                        deleteIcon={<Tooltip title="Delete option"><DeleteIcon fontSize="small" /></Tooltip>}
                        onClick={() => setEditingOption({ id: o.id, name: o.name, absPrice: String(abs.toFixed(2)) })}
                      />
                    );
                  })}
                  {g.options.length === 0 && (
                    <Typography variant="caption" color="text.secondary">
                      No options yet — add one below.
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                  <Button size="small" variant="text" onClick={() => setEditingGroup({ id: g.id, name: g.name, maxSelections: g.maxSelections })}>Rename</Button>
                  {g.options.map((o) => (
                    <Button key={o.id} size="small" variant="text" color={o.available ? 'warning' : 'success'} onClick={() => onToggleOption(o.id, !o.available)}>
                      {o.available ? `86 ${o.name}` : `Restock ${o.name}`}
                    </Button>
                  ))}
                </Box>
                {editingGroup?.id === g.id && (
                  <Box component="form" onSubmit={onSaveGroupEdit} sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <TextField size="small" label="Group name" value={editingGroup.name} onChange={(e) => setEditingGroup((s) => ({ ...s, name: e.target.value }))} />
                    <TextField size="small" label="Max" type="number" value={editingGroup.maxSelections} onChange={(e) => setEditingGroup((s) => ({ ...s, maxSelections: e.target.value }))} sx={{ maxWidth: 90 }} />
                    <Button type="submit" size="small" variant="contained">Save</Button>
                    <Button size="small" onClick={() => setEditingGroup(null)}>Cancel</Button>
                  </Box>
                )}
              </Box>
            );
          })}
          {editingOption && (
            <Box component="form" onSubmit={onSaveOptionEdit} sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'primary.main', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <TextField size="small" label="Option name" value={editingOption.name} onChange={(e) => setEditingOption((s) => ({ ...s, name: e.target.value }))} />
              <TextField size="small" label={`Absolute ₹ (base ₹${Number(modOpen?.price ?? 0).toFixed(2)})`} type="number" value={editingOption.absPrice} onChange={(e) => setEditingOption((s) => ({ ...s, absPrice: e.target.value }))} sx={{ maxWidth: 180 }} />
              <Button type="submit" size="small" variant="contained">Save price</Button>
              <Button size="small" onClick={() => setEditingOption(null)}>Cancel</Button>
            </Box>
          )}
          <Typography variant="subtitle2" fontWeight={800}>Add group</Typography>
          <Box component="form" onSubmit={onCreateGroup} sx={{ display: 'grid', gap: 1.5 }}>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: '2fr 1fr 1fr' }}>
              <TextField size="small" label="Group name" required value={groupForm.name} onChange={(e) => setGroupForm((s) => ({ ...s, name: e.target.value }))} placeholder="Size" />
              <TextField size="small" label="Max picks" type="number" value={groupForm.maxSelections} disabled={!!groupForm.variantMode} onChange={(e) => setGroupForm((s) => ({ ...s, maxSelections: e.target.value }))} />
              <TextField size="small" label="Required?" select value={groupForm.required ? 'yes' : 'no'} disabled={!!groupForm.variantMode} onChange={(e) => setGroupForm((s) => ({ ...s, required: e.target.value === 'yes' }))}>
                <MenuItem value="no">Optional</MenuItem>
                <MenuItem value="yes">Required</MenuItem>
              </TextField>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Switch size="small" checked={!!groupForm.variantMode} onChange={(_, v) => setGroupForm((s) => ({ ...s, variantMode: v }))} />
              <Typography variant="caption" fontWeight={700}>Variant mode: required single-select (S/M/L pattern, max 1)</Typography>
            </Box>
            <Button type="submit" variant="outlined" size="small">Add group</Button>
          </Box>
          <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 1 }}>Add option (absolute ₹ preferred)</Typography>
          <Box component="form" onSubmit={onCreateOption} sx={{ display: 'grid', gap: 1.5 }}>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: '1fr 1fr' }}>
              <TextField size="small" label="Group" select required value={optForm.groupId} onChange={(e) => setOptForm((s) => ({ ...s, groupId: e.target.value }))}>
                <MenuItem value="">Select…</MenuItem>
                {modGroups.map((g) => (
                  <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>
                ))}
              </TextField>
              <TextField size="small" label="Option name" required value={optForm.name} onChange={(e) => setOptForm((s) => ({ ...s, name: e.target.value }))} placeholder="Large" />
            </Box>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: '1fr 1fr 1fr' }}>
              <TextField size="small" label={`Absolute ₹ (base ₹${Number(modOpen?.price ?? 0).toFixed(2)})`} type="number" value={optForm.absPrice} onChange={(e) => setOptForm((s) => ({ ...s, absPrice: e.target.value }))} placeholder="199" />
              <TextField size="small" label="+ ₹ delta" type="number" value={optForm.additionalPrice} onChange={(e) => setOptForm((s) => ({ ...s, additionalPrice: e.target.value }))} />
              <TextField size="small" label="Default?" select value={optForm.defaultOption ? 'yes' : 'no'} onChange={(e) => setOptForm((s) => ({ ...s, defaultOption: e.target.value === 'yes' }))}>
                <MenuItem value="no">No</MenuItem>
                <MenuItem value="yes">★ Default</MenuItem>
              </TextField>
            </Box>
            <Button type="submit" variant="outlined" size="small">Add option</Button>
          </Box>
          {formError && <Alert severity="error">{formError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModOpen(null)}>Done</Button>
        </DialogActions>
      </Dialog>

      {/* toast */}
      {toast && (
        <Box
          sx={{
            position: 'fixed',
            bottom: { xs: 140, md: 24 },
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1400,
            bgcolor: '#1E1B19',
            color: '#fff',
            px: 2.5,
            py: 1.5,
            borderRadius: 999,
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            boxShadow: 4,
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            maxWidth: '90vw',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <Sym name="check_circle" size={18} />
          {toast}
        </Box>
      )}
    </Box>
  );
}

function EmptyStateFallback({ query, catName, onAdd }) {
  return (
    <Card sx={{ borderRadius: 2, border: '1.5px dashed #E1BFB5', textAlign: 'center', p: 4 }}>
      <Typography variant="h6" fontWeight={800}>
        {query ? `No items match “${query}”.` : `No items in ${catName} yet.`}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Add your first dish — it goes live on QR instantly.
      </Typography>
      <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd} sx={{ borderRadius: 2, fontWeight: 800 }}>
        Add Dish
      </Button>
    </Card>
  );
}
