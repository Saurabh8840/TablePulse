import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import VegMark from '../../components/VegMark.jsx';

/** Item detail modal: modifiers with required/max rules + live price.
 *  Zomato-style: image header, grouped options, sticky total footer. */
export default function ItemModal({ item, onClose, onAdd }) {
  const [picked, setPicked] = useState({}); // optionId -> option
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');

  const groups = item.modifierGroups ?? [];

  const modsTotal = useMemo(
    () => Object.values(picked).reduce((n, o) => n + Number(o.additionalPrice), 0),
    [picked],
  );
  const total = (Number(item.price) + modsTotal) * qty;

  const toggle = (group, option) => {
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
      next[option.id] = { ...option, groupId: group.id };
      return next;
    });
  };

  const missing = groups.filter((g) => {
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
      modifiers: Object.values(picked).map((o) => ({ id: o.id, name: o.name, price: Number(o.additionalPrice) })),
      note: note.trim() || undefined,
    });
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 4, overflow: 'hidden' } }}>
      {/* Image header */}
      <Box sx={{ position: 'relative', height: 190, bgcolor: 'action.hover', flexShrink: 0 }}>
        {item.imageUrl ? (
          <Box component="img" src={item.imageUrl} alt={item.name}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Box sx={{
            width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 64, fontWeight: 800, color: 'primary.main',
            background: 'linear-gradient(135deg, #fff5ed, #ffe8d5)',
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
          <Typography variant="h6" fontWeight={800} sx={{ color: '#fff', flexGrow: 1 }} className="clamp-1">
            {item.name}
          </Typography>
          <Chip label={`₹${Number(item.price).toFixed(2)}`} sx={{ bgcolor: '#fff', fontWeight: 800 }} size="small" />
        </Box>
      </Box>

      <DialogContent sx={{ display: 'grid', gap: 2, pt: 2, pb: 1 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          {item.preparationTimeMinutes ? <Chip size="small" label={`~${item.preparationTimeMinutes} min`} variant="outlined" /> : null}
          {(item.modifierGroups ?? []).length > 0 && <Chip size="small" label="Customisable" color="primary" variant="outlined" />}
          {!item.available && <Chip size="small" label="Sold out" color="warning" />}
        </Box>
        {item.description && (
          <Typography variant="body2" color="text.secondary">
            {item.description}
          </Typography>
        )}
        {groups.map((g) => (
          <Box key={g.id} sx={{ p: 1.5, borderRadius: 3, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Typography variant="subtitle2" fontWeight={800}>
              {g.name}
              <Typography component="span" variant="caption" color={missing.includes(g) ? 'error.main' : 'text.secondary'} sx={{ ml: 1 }}>
                {g.required ? `Required · pick ${Math.max(g.minSelections, 1)}${g.maxSelections > 1 ? `–${g.maxSelections}` : ''}` : `Optional · up to ${g.maxSelections}`}
              </Typography>
            </Typography>
            {g.maxSelections === 1 ? (
              <RadioGroup sx={{ mt: 0.5 }}>
                {g.options.filter((o) => o.available).map((o) => (
                  <FormControlLabel
                    key={o.id}
                    control={<Radio checked={!!picked[o.id]} onChange={() => toggle(g, o)} />}
                    label={`${o.name}${o.additionalPrice > 0 ? ` (+₹${o.additionalPrice})` : ''}`}
                  />
                ))}
              </RadioGroup>
            ) : (
              <Box sx={{ mt: 0.5 }}>
                {g.options.filter((o) => o.available).map((o) => (
                  <FormControlLabel
                    key={o.id}
                    control={<Checkbox checked={!!picked[o.id]} onChange={() => toggle(g, o)} />}
                    label={`${o.name}${o.additionalPrice > 0 ? ` (+₹${o.additionalPrice})` : ''}`}
                  />
                ))}
              </Box>
            )}
          </Box>
        ))}
        <TextField label="Note for the kitchen (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="No onion, less spicy…" size="small" />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={700}>Qty</Typography>
          <Button variant="outlined" size="small" onClick={() => setQty((q) => Math.max(1, q - 1))} sx={{ minWidth: 40 }}>−</Button>
          <Typography variant="h6" sx={{ minWidth: 32, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{qty}</Typography>
          <Button variant="outlined" size="small" onClick={() => setQty((q) => Math.min(20, q + 1))} sx={{ minWidth: 40 }}>+</Button>
          {missing.length > 0 && (
            <Chip color="warning" size="small" label={`Pick ${missing[0].name} to continue`} sx={{ ml: 'auto' }} />
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 1, position: 'sticky', bottom: 0, bgcolor: 'background.paper' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={missing.length > 0} onClick={submit} sx={{ flexGrow: 1, borderRadius: 3, py: 1.25 }}>
          Add to cart · ₹{total.toFixed(2)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
