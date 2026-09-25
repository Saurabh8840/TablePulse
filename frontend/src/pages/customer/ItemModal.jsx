import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  FormControlLabel,
  IconButton,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import VegMark from '../../components/VegMark.jsx';

/** Item detail modal: modifiers with required/max rules + live price.
 *  Fix 3: S/M/L variant-lite — required single-select groups pre-select
 *  default (else Small/first), options show absolute ₹, sold-out shown
 *  disabled instead of hidden.
 *  Fix 4: size-matrix — variant items show a qty stepper per size
 *  (S − 1 +, M − 0 +, L − 2 +) so 1 Small + 2 Large lands in one tap.
 *  Zomato-style: image header, grouped options. */
export default function ItemModal({ item, onClose, onAdd, onAddLines }) {
  const groups = item.modifierGroups ?? [];
  const base = Number(item.price);

  // Variant group = first required single-select with 2+ options (Size S/M/L).
  const sizeGroup = groups.find((g) => g.required && g.maxSelections === 1 && (g.options ?? []).length > 1) ?? null;
  const otherGroups = sizeGroup ? groups.filter((g) => g.id !== sizeGroup.id) : groups;

  // Pre-select default (else first available) for required single-select
  // groups like Size, so Cappuccino opens with Small chosen.
  const [picked, setPicked] = useState(() => {
    const init = {};
    for (const g of otherGroups) {
      if (g.required && g.maxSelections === 1) {
        const opts = (g.options ?? []).filter((o) => o.available);
        const def = opts.find((o) => o.defaultOption) ?? opts[0];
        if (def) init[def.id] = { ...def, groupId: g.id, groupName: g.name };
      }
    }
    // Non-matrix single-size required group (only one option): keep old behavior.
    if (!sizeGroup) {
      for (const g of groups) {
        if (g.required && g.maxSelections === 1 && (g.options ?? []).length <= 1) {
          const opts = (g.options ?? []).filter((o) => o.available);
          const def = opts.find((o) => o.defaultOption) ?? opts[0];
          if (def) init[def.id] = { ...def, groupId: g.id, groupName: g.name };
        }
      }
    }
    return init;
  });
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');

  // Fix 4: per-size quantities. Default/first available starts at 1 so a
  // plain Cappuccino tap = 1 Small without extra work.
  const [sizeQty, setSizeQty] = useState(() => {
    if (!sizeGroup) return {};
    const avail = (sizeGroup.options ?? []).filter((o) => o.available);
    const def = avail.find((o) => o.defaultOption) ?? avail[0];
    const init = {};
    for (const o of sizeGroup.options ?? []) init[o.id] = o.id === def?.id ? 1 : 0;
    return init;
  });

  const modsTotal = useMemo(
    () => Object.values(picked).reduce((n, o) => n + Number(o.additionalPrice), 0),
    [picked],
  );
  const total = (Number(item.price) + modsTotal) * qty;

  const matrix = useMemo(() => {
    if (!sizeGroup) return null;
    const rows = (sizeGroup.options ?? []).map((o) => {
      const q = sizeQty[o.id] ?? 0;
      const abs = base + Number(o.additionalPrice ?? 0);
      return { option: o, qty: q, abs, lineTotal: (abs + modsTotal) * q };
    });
    const count = rows.reduce((n, r) => n + r.qty, 0);
    const amount = rows.reduce((n, r) => n + r.lineTotal, 0);
    return { rows, count, amount };
  }, [sizeGroup, sizeQty, base, modsTotal]);

  const bumpSize = (id, d) =>
    setSizeQty((prev) => {
      const opt = (sizeGroup.options ?? []).find((o) => o.id === id);
      if (!opt || !opt.available) return prev;
      const next = Math.max(0, Math.min(20, (prev[id] ?? 0) + d));
      return { ...prev, [id]: next };
    });

  const toggle = (group, option) => {
    if (!option.available) return;
    setPicked((prev) => {
      const next = { ...prev };
      const inGroup = Object.values(next).filter((o) => o.groupId === group.id);
      if (next[option.id]) {
        if (group.required && inGroup.length <= Math.max(group.minSelections, 1)) return prev;
        delete next[option.id];
        return next;
      }
      if (inGroup.length >= group.maxSelections) {
        // replace oldest pick in single-select groups
        if (group.maxSelections === 1) {
          inGroup.forEach((o) => delete next[o.id]);
        } else {
          return prev;
        }
      }
      next[option.id] = { ...option, groupId: group.id, groupName: group.name };
      return next;
    });
  };

  const missingOthers = otherGroups.filter((g) => {
    const need = g.required ? Math.max(g.minSelections, 1) : 0;
    const have = Object.values(picked).filter((o) => o.groupId === g.id).length;
    return have < need;
  });
  // Matrix mode: size requirement satisfied by any qty > 0 across sizes.
  const missing = sizeGroup
    ? missingOthers.concat((matrix?.count ?? 0) > 0 ? [] : [{ ...sizeGroup, name: `${sizeGroup.name} qty` }])
    : groups.filter((g) => {
        const need = g.required ? Math.max(g.minSelections, 1) : 0;
        const have = Object.values(picked).filter((o) => o.groupId === g.id).length;
        return have < need;
      });

  function submit() {
    onAdd({
      menuItemId: item.id,
      name: item.name,
      unitPrice: Number(item.price),
      qty,
      modsTotal,
      modifiers: Object.values(picked).map((o) => ({
        id: o.id,
        name: o.name,
        price: Number(o.additionalPrice),
        groupName: o.groupName,
        absolutePrice: base + Number(o.additionalPrice ?? 0),
      })),
      note: note.trim() || undefined,
    });
  }

  function submitMatrix() {
    if (!matrix || matrix.count === 0) return;
    const extras = Object.values(picked).map((o) => ({
      id: o.id,
      name: o.name,
      price: Number(o.additionalPrice),
      groupName: o.groupName,
      absolutePrice: base + Number(o.additionalPrice ?? 0),
    }));
    const extrasDelta = modsTotal;
    const lines = matrix.rows
      .filter((r) => r.qty > 0)
      .map((r) => ({
        menuItemId: item.id,
        name: item.name,
        unitPrice: Number(item.price),
        qty: r.qty,
        modsTotal: Number(r.option.additionalPrice ?? 0) + extrasDelta,
        modifiers: [
          {
            id: r.option.id,
            name: r.option.name,
            price: Number(r.option.additionalPrice),
            groupName: sizeGroup.name,
            absolutePrice: r.abs,
          },
          ...extras,
        ],
        note: note.trim() || undefined,
      }));
    if (onAddLines) onAddLines(lines);
    else lines.forEach((l) => onAdd(l));
  }

  const renderOptionRow = (g, o) => {
    const abs = base + Number(o.additionalPrice ?? 0);
    const soldOut = !o.available;
    const control =
      g.maxSelections === 1 ? (
        <Radio checked={!!picked[o.id]} onChange={() => { if (!soldOut) toggle(g, o); }} />
      ) : (
        <Checkbox checked={!!picked[o.id]} onChange={() => { if (!soldOut) toggle(g, o); }} />
      );
    return (
      <FormControlLabel
        key={o.id}
        disabled={soldOut}
        control={control}
        label={`${o.name} — ₹${abs.toFixed(2)}${o.defaultOption ? ' · default' : ''}${soldOut ? ' (sold out)' : ''}`}
      />
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { borderRadius: 2, overflow: 'hidden', maxHeight: '92vh', m: 2 } }}
    >
      {/* Photo header — FIXED height frame: any upload aspect (portrait,
          landscape, square) fills the same window via cover, never blows up. */}
      <Box sx={{ position: 'relative', height: { xs: 210, sm: 230 }, flexShrink: 0, overflow: 'hidden', bgcolor: 'action.hover' }}>
        {item.imageUrl ? (
          <Box
            component="img"
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            decoding="async"
            sx={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
          />
        ) : (
          <Box sx={{
            width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 64, fontWeight: 800, letterSpacing: '-0.02em', color: 'primary.main',
          }}>
            {item.name?.[0]?.toUpperCase()}
          </Box>
        )}
        <Box sx={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 55%)',
        }} />
        <Box sx={{ position: 'absolute', left: 16, right: 16, bottom: 12, display: 'flex', alignItems: 'center', gap: 1 }}>
          <VegMark veg={!!item.vegetarian} size={18} />
          <Typography variant="h6" fontWeight={800} sx={{ color: '#fff', flexGrow: 1, letterSpacing: '-0.01em' }} className="clamp-1">
            {item.name}
          </Typography>
          <Chip label={`₹${Number(item.price).toFixed(2)}`} sx={{ bgcolor: '#fff', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }} size="small" />
        </Box>
      </Box>

      <DialogContent sx={{ display: 'grid', gap: 2, pt: 2, pb: 1 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          {item.preparationTimeMinutes ? <Chip size="small" label={`~${item.preparationTimeMinutes} min`} variant="outlined" /> : null}
          {(item.modifierGroups ?? []).length > 0 && <Chip size="small" label="Customisable" color="primary" variant="outlined" />}
          {sizeGroup && <Chip size="small" label="Multi-size: pick qty per size" color="secondary" variant="outlined" />}
          {!item.available && <Chip size="small" label="Sold out" color="warning" />}
        </Box>
        {item.description && (
          <Typography variant="body2" color="text.secondary">
            {item.description}
          </Typography>
        )}
        {/* Fix 4 matrix: one stepper row per size */}
        {sizeGroup && matrix && (
          <Box sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
            <Typography variant="subtitle2" fontWeight={800}>
              {sizeGroup.name}
              <Typography component="span" variant="caption" color={matrix.count > 0 ? 'text.secondary' : 'error.main'} sx={{ ml: 1 }}>
                {matrix.count > 0 ? `${matrix.count} selected` : 'Required · set qty for at least one size'}
              </Typography>
            </Typography>
            <Box sx={{ display: 'grid', gap: 1, mt: 1 }}>
              {matrix.rows.map((r) => (
                <Box key={r.option.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={700} noWrap>
                      {r.option.name} — ₹{r.abs.toFixed(2)}
                      {!r.option.available && (
                        <Typography component="span" variant="caption" color="warning.main"> · sold out</Typography>
                      )}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, border: 1, borderColor: 'divider', borderRadius: 20, px: 0.25, py: 0.1, bgcolor: 'background.paper' }}>
                    <IconButton size="small" aria-label={`less ${r.option.name}`} disabled={!r.option.available || r.qty <= 0} onClick={() => bumpSize(r.option.id, -1)} sx={{ width: 26, height: 26 }}>
                      <RemoveIcon fontSize="small" />
                    </IconButton>
                    <Typography variant="body2" fontWeight={800} sx={{ minWidth: 20, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                      {r.qty}
                    </Typography>
                    <IconButton size="small" aria-label={`more ${r.option.name}`} disabled={!r.option.available || r.qty >= 20} onClick={() => bumpSize(r.option.id, 1)} sx={{ width: 26, height: 26 }}>
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}
        {otherGroups.map((g) => (
          <Box key={g.id} sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
            <Typography variant="subtitle2" fontWeight={800}>
              {g.name}
              <Typography component="span" variant="caption" color={missing.includes(g) ? 'error.main' : 'text.secondary'} sx={{ ml: 1 }}>
                {g.required ? `Required · pick ${Math.max(g.minSelections, 1)}${g.maxSelections > 1 ? `–${g.maxSelections}` : ''}` : `Optional · up to ${g.maxSelections}`}
              </Typography>
            </Typography>
            {g.maxSelections === 1 ? (
              <RadioGroup sx={{ mt: 0.5 }}>
                {(g.options ?? []).map((o) => renderOptionRow(g, o))}
              </RadioGroup>
            ) : (
              <Box sx={{ mt: 0.5 }}>
                {(g.options ?? []).map((o) => renderOptionRow(g, o))}
              </Box>
            )}
          </Box>
        ))}
        {/* Non-matrix fallback: single-size required group renders here */}
        {!sizeGroup && groups.filter((g) => !otherGroups.includes(g)).map((g) => (
          <Box key={g.id} sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
            <Typography variant="subtitle2" fontWeight={800}>
              {g.name}
              <Typography component="span" variant="caption" color={missing.includes(g) ? 'error.main' : 'text.secondary'} sx={{ ml: 1 }}>
                {g.required ? `Required · pick ${Math.max(g.minSelections, 1)}${g.maxSelections > 1 ? `–${g.maxSelections}` : ''}` : `Optional · up to ${g.maxSelections}`}
              </Typography>
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              {(g.options ?? []).map((o) => renderOptionRow(g, o))}
            </Box>
          </Box>
        ))}
        <TextField label="Note for the kitchen (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="No onion, less spicy…" size="small" />
        {!sizeGroup && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={700}>Qty</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, border: 1, borderColor: 'divider', borderRadius: 20, px: 0.25, py: 0.1 }}>
              <IconButton size="small" aria-label="decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))} sx={{ width: 26, height: 26 }}>
                <RemoveIcon fontSize="small" />
              </IconButton>
              <Typography variant="body2" fontWeight={800} sx={{ minWidth: 20, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{qty}</Typography>
              <IconButton size="small" aria-label="increase quantity" onClick={() => setQty((q) => Math.min(20, q + 1))} sx={{ width: 26, height: 26 }}>
                <AddIcon fontSize="small" />
              </IconButton>
            </Box>
            {missing.length > 0 && (
              <Chip color="warning" size="small" label={`Pick ${missing[0].name} to continue`} sx={{ ml: 'auto' }} />
            )}
          </Box>
        )}
        {sizeGroup && missingOthers.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Chip color="warning" size="small" label={`Pick ${missingOthers[0].name} to continue`} />
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 1, position: 'sticky', bottom: 0, bgcolor: 'background.paper' }}>
        <Button onClick={onClose} sx={{ fontWeight: 700 }}>Cancel</Button>
        {sizeGroup ? (
          <Button variant="contained" disabled={missing.length > 0} onClick={submitMatrix} sx={{ flexGrow: 1, borderRadius: 2, py: 1.25, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            Add {matrix.count} to cart · ₹{matrix.amount.toFixed(2)}
          </Button>
        ) : (
          <Button variant="contained" disabled={missing.length > 0} onClick={submit} sx={{ flexGrow: 1, borderRadius: 2, py: 1.25, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            Add to cart · ₹{total.toFixed(2)}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
