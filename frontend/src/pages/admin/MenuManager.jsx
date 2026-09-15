import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
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
  IconButton,
  InputAdornment,
  MenuItem,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import VegMark from '../../components/VegMark.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import {
  createCategory,
  createItem,
  createModifierGroup,
  createModifierOption,
  deleteItem,
  deleteItemImage,
  listCategories,
  listItems,
  listModifierGroups,
  restoreItem,
  setAvailability,
  updateItem,
  uploadItemImage,
} from '../../services/menu.js';

const EMPTY_ITEM = { name: '', description: '', price: '', vegetarian: false, preparationTimeMinutes: '' };

function elapsedShort(iso) {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ${min % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function MenuManager() {
  const { id: restaurantId } = useParams();
  const [cats, setCats] = useState(null);
  const [activeCat, setActiveCat] = useState(null);
  const [items, setItems] = useState(null);
  const [modGroups, setModGroups] = useState([]);
  const [error, setError] = useState(null);
  const [catOpen, setCatOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(null); // item being edited
  const [deleteOpen, setDeleteOpen] = useState(null); // item pending delete
  const [modOpen, setModOpen] = useState(null); // item being edited for modifiers
  const [catForm, setCatForm] = useState({ name: '', description: '' });
  const [itemForm, setItemForm] = useState(EMPTY_ITEM);
  const [itemPhoto, setItemPhoto] = useState(null); // File for Add dialog
  const [itemPhotoUrl, setItemPhotoUrl] = useState(null); // preview URL
  const [editForm, setEditForm] = useState(EMPTY_ITEM);
  const [editPhoto, setEditPhoto] = useState(null); // new File or 'REMOVE'
  const [editPhotoUrl, setEditPhotoUrl] = useState(null);
  const [groupForm, setGroupForm] = useState({ name: '', required: false, maxSelections: 1 });
  const [optForm, setOptForm] = useState({ groupId: '', name: '', additionalPrice: 0 });
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');

  const loadCats = (selectFirst = false) =>
    listCategories(restaurantId).then((r) => {
      setCats(r.data);
      if (selectFirst && r.data.length > 0) setActiveCat(r.data[0]);
    });

  const loadItems = () => {
    if (!activeCat) {
      setItems(null);
      return Promise.resolve();
    }
    return listItems(activeCat.id).then((r) => setItems(r.data));
  };

  useEffect(() => {
    loadCats(true).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  useEffect(() => {
    loadItems().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCat]);

  const visibleItems = useMemo(() => {
    const list = items ?? [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? list.filter((i) => `${i.name} ${i.description ?? ''}`.toLowerCase().includes(q))
      : list;
    // Active first, then inactive (deleted) greyed at the bottom.
    return [...filtered].sort((a, b) => Number(b.active ?? true) - Number(a.active ?? true));
  }, [items, query]);

  function previewFile(file, setUrl, prev) {
    if (prev) URL.revokeObjectURL(prev);
    if (!file) {
      setUrl(null);
      return null;
    }
    const url = URL.createObjectURL(file);
    setUrl(url);
    return url;
  }

  function closeAdd() {
    setItemOpen(false);
    setItemForm(EMPTY_ITEM);
    setItemPhoto(null);
    if (itemPhotoUrl) URL.revokeObjectURL(itemPhotoUrl);
    setItemPhotoUrl(null);
    setFormError(null);
  }

  function closeEdit() {
    setEditOpen(null);
    setEditForm(EMPTY_ITEM);
    setEditPhoto(null);
    if (editPhotoUrl) URL.revokeObjectURL(editPhotoUrl);
    setEditPhotoUrl(null);
    setFormError(null);
  }

  async function onCreateCat(e) {
    e.preventDefault();
    setFormError(null);
    try {
      const r = await createCategory(restaurantId, { ...catForm, displayOrder: cats?.length ?? 0 });
      setCatOpen(false);
      setCatForm({ name: '', description: '' });
      await loadCats();
      setActiveCat(r.data);
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function onCreateItem(e) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const created = await createItem(activeCat.id, {
        name: itemForm.name,
        description: itemForm.description || undefined,
        price: Number(itemForm.price),
        vegetarian: itemForm.vegetarian,
        preparationTimeMinutes: itemForm.preparationTimeMinutes ? Number(itemForm.preparationTimeMinutes) : undefined,
        displayOrder: items?.length ?? 0,
      });
      if (itemPhoto) {
        await uploadItemImage(created.data.id, itemPhoto);
      }
      closeAdd();
      await loadItems();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(item) {
    setEditOpen(item);
    setEditForm({
      name: item.name ?? '',
      description: item.description ?? '',
      price: String(item.price ?? ''),
      vegetarian: !!item.vegetarian,
      preparationTimeMinutes: item.preparationTimeMinutes ? String(item.preparationTimeMinutes) : '',
    });
    setEditPhoto(null);
    setEditPhotoUrl(null);
    setFormError(null);
  }

  async function onSaveEdit(e) {
    e.preventDefault();
    if (!editOpen) return;
    setFormError(null);
    setSaving(true);
    try {
      await updateItem(editOpen.id, {
        name: editForm.name,
        description: editForm.description || null,
        price: Number(editForm.price),
        vegetarian: editForm.vegetarian,
        preparationTimeMinutes: editForm.preparationTimeMinutes ? Number(editForm.preparationTimeMinutes) : null,
      });
      if (editPhoto === 'REMOVE') {
        await deleteItemImage(editOpen.id);
      } else if (editPhoto instanceof File) {
        await uploadItemImage(editOpen.id, editPhoto);
      }
      closeEdit();
      await loadItems();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onConfirmDelete() {
    if (!deleteOpen) return;
    try {
      await deleteItem(deleteOpen.id);
      setDeleteOpen(null);
      await loadItems();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onRestore(item) {
    try {
      await restoreItem(item.id);
      await loadItems();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onToggle(item, v) {
    try {
      const res = await setAvailability(item.id, v);
      // Use the server row so attribution (lastChangedBy/updatedAt) stays in sync.
      setItems((list) => list.map((i) => (i.id === item.id ? { ...i, ...(res.data ?? { available: v }) } : i)));
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
      .then((r) => setModGroups(r.data))
      .catch((e) => setError(e.message));
  }, [modOpen]);

  async function onCreateGroup(e) {
    e.preventDefault();
    setFormError(null);
    try {
      await createModifierGroup(modOpen.id, {
        name: groupForm.name,
        required: groupForm.required,
        minSelections: groupForm.required ? 1 : 0,
        maxSelections: Number(groupForm.maxSelections) || 1,
        displayOrder: modGroups.length,
      });
      setGroupForm({ name: '', required: false, maxSelections: 1 });
      listModifierGroups(modOpen.id).then((r) => setModGroups(r.data));
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function onCreateOption(e) {
    e.preventDefault();
    setFormError(null);
    try {
      await createModifierOption(optForm.groupId, {
        name: optForm.name,
        additionalPrice: Number(optForm.additionalPrice) || 0,
      });
      setOptForm({ groupId: '', name: '', additionalPrice: 0 });
      listModifierGroups(modOpen.id).then((r) => setModGroups(r.data));
    } catch (err) {
      setFormError(err.message);
    }
  }

  const editPreview = editPhoto === 'REMOVE'
    ? null
    : editPhotoUrl ?? editOpen?.imageUrl ?? null;

  return (
    <Box>
      <PageHeader
        title="Menu manager"
        subtitle="Categories → items → modifiers. Toggle availability for 86-ing."
        actions={
          <>
            <Button component={RouterLink} to={`/admin/restaurants/${restaurantId}`} startIcon={<ArrowBackIcon />} variant="text">
              Restaurant
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCatOpen(true)}>
              New category
            </Button>
          </>
        }
      />
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {(cats ?? []).map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            color={activeCat?.id === c.id ? 'primary' : 'default'}
            onClick={() => setActiveCat(c)}
            sx={{ fontWeight: 700 }}
          />
        ))}
        {cats?.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No categories yet — create one to start the menu.
          </Typography>
        )}
      </Box>

      {activeCat && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {activeCat.name} ({items?.length ?? 0})
          </Typography>
          <TextField
            size="small"
            placeholder="Search items…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ maxWidth: 240 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />
          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setItemOpen(true)}>
            Add item
          </Button>
        </Box>
      )}

      {/* Zomato-style item grid: 1 col phone, 2 tablet, 3 desktop */}
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', xl: 'repeat(3, 1fr)' } }}>
        {visibleItems.map((i) => {
          const inactive = !(i.active ?? true);
          return (
            <Card key={i.id} sx={{ opacity: !i.available || inactive ? 0.65 : 1, borderRadius: 3, overflow: 'hidden' }}>
              <CardContent sx={{ display: 'flex', gap: 1.5, p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                    <VegMark veg={!!i.vegetarian} size={15} />
                    {!i.available && !inactive && <Chip size="small" label="Sold out" color="warning" sx={{ height: 20 }} />}
                    {inactive && <Chip size="small" label="Hidden" color="default" sx={{ height: 20 }} />}
                  </Box>
                  <Typography variant="subtitle1" fontWeight={800} noWrap lineHeight={1.25}>
                    {i.name}
                  </Typography>
                  <Typography variant="body2" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    ₹{Number(i.price).toFixed(2)}
                  </Typography>
                  {i.description && (
                    <Typography variant="body2" color="text.secondary" className="clamp-2" sx={{ mt: 0.25 }}>
                      {i.description}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                    <Switch
                      size="small"
                      checked={!!i.available}
                      disabled={inactive}
                      onChange={(_, v) => onToggle(i, v)}
                      slotProps={{ input: { 'aria-label': `availability of ${i.name}` } }}
                    />
                    <Typography variant="caption" color="text.secondary">Available</Typography>
                    {i.lastChangedBy && (
                      <Typography variant="caption" color="text.secondary" sx={{ width: '100%' }}>
                        {!i.available ? '🔴 Sold out' : '🟢 Restocked'} · by {i.lastChangedBy}
                        {i.updatedAt ? ` · ${elapsedShort(i.updatedAt)}` : ''}
                      </Typography>
                    )}
                    <Box sx={{ flexGrow: 1 }} />
                    {!inactive ? (
                      <>
                        <Tooltip title="Edit item">
                          <IconButton size="small" onClick={() => openEdit(i)} aria-label={`edit ${i.name}`}>
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
                      <Button size="small" startIcon={<RestoreIcon />} onClick={() => onRestore(i)}>
                        Restore
                      </Button>
                    )}
                  </Box>
                  <Button size="small" variant="text" sx={{ mt: 0.5, px: 0 }} onClick={() => { setModOpen(i); setFormError(null); }}>
                    Modifiers →
                  </Button>
                </Box>
                <Box sx={{ width: 112, flexShrink: 0 }}>
                  <Box sx={{
                    width: 112, height: 92, borderRadius: 2.5, overflow: 'hidden',
                    bgcolor: 'action.hover', border: 1, borderColor: 'divider',
                  }}>
                    {i.imageUrl ? (
                      <Box component="img" src={i.imageUrl} alt={i.name} loading="lazy"
                        sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Box sx={{
                        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 28, fontWeight: 800, color: 'primary.main',
                        background: 'linear-gradient(135deg, #fff5ed, #ffe8d5)',
                      }}>
                        {i.name?.[0]?.toUpperCase()}
                      </Box>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>
      {activeCat && items?.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No items in {activeCat.name} yet.
        </Typography>
      )}
      {activeCat && items?.length > 0 && visibleItems.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No items match “{query}”.
        </Typography>
      )}

      {/* Category dialog */}
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

      {/* Add item dialog — with photo picker */}
      <Dialog open={itemOpen} onClose={closeAdd} fullWidth maxWidth="sm">
        <DialogTitle>Add item to {activeCat?.name}</DialogTitle>
        <Box component="form" onSubmit={onCreateItem}>
          <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Avatar
                src={itemPhotoUrl ?? undefined}
                variant="rounded"
                sx={{ width: 72, height: 72, bgcolor: 'action.hover', color: 'primary.main', fontWeight: 800 }}
              >
                {!itemPhotoUrl && (itemForm.name?.[0]?.toUpperCase() || <PhotoCameraIcon />)}
              </Avatar>
              <Button size="small" variant="outlined" component="label" startIcon={<PhotoCameraIcon />}>
                Add photo
                <input type="file" hidden accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setItemPhoto(f);
                    previewFile(f, setItemPhotoUrl, itemPhotoUrl);
                  }} />
              </Button>
              {itemPhoto && (
                <Button size="small" onClick={() => { setItemPhoto(null); previewFile(null, setItemPhotoUrl, itemPhotoUrl); }}>
                  Clear
                </Button>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">JPEG / PNG / WebP, max 5MB. Optional — you can add it later.</Typography>
            <TextField label="Name" required value={itemForm.name} onChange={(e) => setItemForm((s) => ({ ...s, name: e.target.value }))} placeholder="Singapore Noodles" />
            <TextField label="Description" multiline rows={2} value={itemForm.description} onChange={(e) => setItemForm((s) => ({ ...s, description: e.target.value }))} />
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr 1fr' }}>
              <TextField label="Price ₹" required type="number" value={itemForm.price} onChange={(e) => setItemForm((s) => ({ ...s, price: e.target.value }))} />
              <TextField label="Prep min" type="number" value={itemForm.preparationTimeMinutes} onChange={(e) => setItemForm((s) => ({ ...s, preparationTimeMinutes: e.target.value }))} />
              <TextField label="Veg?" select value={itemForm.vegetarian ? 'veg' : 'nonveg'} onChange={(e) => setItemForm((s) => ({ ...s, vegetarian: e.target.value === 'veg' }))}>
                <MenuItem value="veg">🟢 Veg</MenuItem>
                <MenuItem value="nonveg">🔴 Non-veg</MenuItem>
              </TextField>
            </Box>
            {formError && <Alert severity="error">{formError}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeAdd}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving…' : 'Create'}</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Edit item dialog — fields + replace/remove photo */}
      <Dialog open={!!editOpen} onClose={closeEdit} fullWidth maxWidth="sm">
        <DialogTitle>Edit — {editOpen?.name}</DialogTitle>
        <Box component="form" onSubmit={onSaveEdit}>
          <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Avatar
                src={editPreview ?? undefined}
                variant="rounded"
                sx={{ width: 72, height: 72, bgcolor: 'action.hover', color: 'primary.main', fontWeight: 800 }}
              >
                {!editPreview && (editForm.name?.[0]?.toUpperCase() || <PhotoCameraIcon />)}
              </Avatar>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button size="small" variant="outlined" component="label" startIcon={<PhotoCameraIcon />}>
                  {editOpen?.imageUrl || editPhotoUrl ? 'Replace' : 'Add photo'}
                  <input type="file" hidden accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      if (!f) return;
                      setEditPhoto(f);
                      previewFile(f, setEditPhotoUrl, editPhotoUrl);
                    }} />
                </Button>
                {(editPreview) && (
                  <Button size="small" color="error" onClick={() => {
                    setEditPhoto('REMOVE');
                    previewFile(null, setEditPhotoUrl, editPhotoUrl);
                  }}>
                    Remove
                  </Button>
                )}
              </Box>
            </Box>
            <TextField label="Name" required value={editForm.name} onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))} />
            <TextField label="Description" multiline rows={2} value={editForm.description} onChange={(e) => setEditForm((s) => ({ ...s, description: e.target.value }))} />
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr 1fr' }}>
              <TextField label="Price ₹" required type="number" value={editForm.price} onChange={(e) => setEditForm((s) => ({ ...s, price: e.target.value }))} />
              <TextField label="Prep min" type="number" value={editForm.preparationTimeMinutes} onChange={(e) => setEditForm((s) => ({ ...s, preparationTimeMinutes: e.target.value }))} />
              <TextField label="Veg?" select value={editForm.vegetarian ? 'veg' : 'nonveg'} onChange={(e) => setEditForm((s) => ({ ...s, vegetarian: e.target.value === 'veg' }))}>
                <MenuItem value="veg">🟢 Veg</MenuItem>
                <MenuItem value="nonveg">🔴 Non-veg</MenuItem>
              </TextField>
            </Box>
            {formError && <Alert severity="error">{formError}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeEdit}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Delete confirm — soft delete */}
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

      {/* Modifiers dialog */}
      <Dialog open={!!modOpen} onClose={() => setModOpen(null)} fullWidth maxWidth="sm">
        <DialogTitle>Modifiers — {modOpen?.name}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
          {modGroups.map((g) => (
            <Box key={g.id} sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={800}>
                {g.name} {g.required && <Chip size="small" label="Required" color="primary" sx={{ ml: 0.5 }} />}
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  pick up to {g.maxSelections}
                </Typography>
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.75 }}>
                {g.options.map((o) => (
                  <Chip
                    key={o.id}
                    size="small"
                    variant="outlined"
                    label={o.additionalPrice > 0 ? `${o.name} (+₹${o.additionalPrice})` : o.name}
                  />
                ))}
                {g.options.length === 0 && (
                  <Typography variant="caption" color="text.secondary">
                    No options yet — add one below.
                  </Typography>
                )}
              </Box>
            </Box>
          ))}
          <Typography variant="subtitle2" fontWeight={800}>Add group</Typography>
          <Box component="form" onSubmit={onCreateGroup} sx={{ display: 'grid', gap: 1.5 }}>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: '2fr 1fr 1fr' }}>
              <TextField size="small" label="Group name" required value={groupForm.name} onChange={(e) => setGroupForm((s) => ({ ...s, name: e.target.value }))} placeholder="Spice Level" />
              <TextField size="small" label="Max picks" type="number" value={groupForm.maxSelections} onChange={(e) => setGroupForm((s) => ({ ...s, maxSelections: e.target.value }))} />
              <TextField size="small" label="Required?" select value={groupForm.required ? 'yes' : 'no'} onChange={(e) => setGroupForm((s) => ({ ...s, required: e.target.value === 'yes' }))}>
                <MenuItem value="no">Optional</MenuItem>
                <MenuItem value="yes">Required</MenuItem>
              </TextField>
            </Box>
            <Button type="submit" variant="outlined" size="small">Add group</Button>
          </Box>
          <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 1 }}>Add option</Typography>
          <Box component="form" onSubmit={onCreateOption} sx={{ display: 'grid', gap: 1.5 }}>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: '1fr 1fr' }}>
              <TextField size="small" label="Group" select required value={optForm.groupId} onChange={(e) => setOptForm((s) => ({ ...s, groupId: e.target.value }))}>
                <MenuItem value="">Select…</MenuItem>
                {modGroups.map((g) => (
                  <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>
                ))}
              </TextField>
              <TextField size="small" label="Option name" required value={optForm.name} onChange={(e) => setOptForm((s) => ({ ...s, name: e.target.value }))} placeholder="Extra Spicy" />
            </Box>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: '1fr 1fr' }}>
              <TextField size="small" label="+ ₹" type="number" value={optForm.additionalPrice} onChange={(e) => setOptForm((s) => ({ ...s, additionalPrice: e.target.value }))} />
              <Button type="submit" variant="outlined" size="small">Add option</Button>
            </Box>
          </Box>
          {formError && <Alert severity="error">{formError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModOpen(null)}>Done</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
