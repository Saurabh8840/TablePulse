import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { GuideFigure } from './ImagePicker.jsx';

const SPEC = {
  title: 'Dish photo',
  hint: 'Square-ish photo, at least 800 × 800 · JPG under ~1 MB',
  formats: 'JPEG, PNG or WebP · up to 5 MB',
  appears: 'Shown on the guest QR menu, the bill, and your menu manager.',
  goodTitle: 'One dish, daylight, close up',
  goodBody: 'A single plated dish filling the frame. Guests tap what they recognize.',
  badTitle: 'Menu card photo or dark table shot',
  badBody: 'Full menu pages, flash glare, and dark blurry tables never sell the dish.',
};

/**
 * Shared dish photo field: upload/replace/remove + live preview + the same
 * premium photo guide as the restaurant pickers. Used by the setup quick-add
 * modal and the menu manager drawer — one component, zero drift.
 *
 * previewUrl: object-URL or server URL to display (null = empty).
 * placeholder: letter shown when empty (usually the dish initial).
 * onPick(file): parent stashes/uploads the File.
 * onRemove(): parent clears the pick (and flags server delete in edit mode).
 */
export default function DishPhotoField({ previewUrl, placeholder, onPick, onRemove, disabled }) {
  const [error, setError] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);

  function handleFile(file) {
    if (!file) return;
    setError(null);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError('Please choose a JPEG, PNG or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be 5 MB or smaller.');
      return;
    }
    onPick(file);
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap', mb: 1 }}>
        <Typography variant="body2" fontWeight={700} fontSize={14}>Dish photo</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          size="small"
          startIcon={<InfoOutlinedIcon fontSize="small" />}
          onClick={() => setGuideOpen(true)}
          sx={{ textTransform: 'none', fontWeight: 700, px: 0, minHeight: 0 }}
        >
          What makes a good dish photo?
        </Button>
      </Box>
      <Box sx={{ borderRadius: 2, p: 2, bgcolor: '#FAF2EE', display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <Avatar src={previewUrl ?? undefined} variant="rounded" sx={{ width: 64, height: 64, borderRadius: 2, bgcolor: '#fff', color: '#9B2F00', fontWeight: 800 }}>
          {!previewUrl && (placeholder || <PhotoCameraIcon />)}
        </Avatar>
        <Box sx={{ flexGrow: 1, minWidth: 180 }}>
          <Button size="small" variant="outlined" component="label" startIcon={<PhotoCameraIcon />} disabled={disabled} sx={{ borderRadius: 2 }}>
            {previewUrl ? 'Replace photo' : 'Upload photo'}
            <input type="file" hidden accept="image/jpeg,image/png,image/webp"
              onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
          </Button>
          {previewUrl && (
            <Button size="small" color="error" sx={{ ml: 1 }} disabled={disabled} onClick={onRemove}>
              Remove
            </Button>
          )}
          <Typography variant="caption" fontSize={10} color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {SPEC.hint}. Sharp daylight shots sell best.
          </Typography>
        </Box>
      </Box>
      {error && <Alert severity="warning" sx={{ mt: 1 }} onClose={() => setError(null)}>{error}</Alert>}

      <Dialog open={guideOpen} onClose={() => setGuideOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={800}>What makes a good dish photo?</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
              <GuideFigure kind="dish" good title={SPEC.goodTitle} badge="do" />
              <Box sx={{ p: 1.5 }}>
                <Typography
                  variant="caption"
                  fontWeight={800}
                  sx={{ display: 'inline-block', px: 1.25, py: 0.25, borderRadius: 999, bgcolor: '#E4F3E5', color: '#1B5E20', letterSpacing: '0.04em' }}
                >
                  RECOMMENDED
                </Typography>
                <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 1 }}>{SPEC.goodTitle}</Typography>
                <Typography variant="body2" color="text.secondary">{SPEC.goodBody}</Typography>
              </Box>
            </Box>
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
              <GuideFigure kind="dish" title={SPEC.badTitle} badge="avoid" />
              <Box sx={{ p: 1.5 }}>
                <Typography
                  variant="caption"
                  fontWeight={800}
                  sx={{ display: 'inline-block', px: 1.25, py: 0.25, borderRadius: 999, bgcolor: '#EFE7E2', color: '#6D4C41', letterSpacing: '0.04em' }}
                >
                  NOT IDEAL
                </Typography>
                <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 1 }}>{SPEC.badTitle}</Typography>
                <Typography variant="body2" color="text.secondary">{SPEC.badBody}</Typography>
              </Box>
            </Box>
          </Box>
          <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: '#FFF8F5', border: 1, borderColor: 'divider' }}>
            <Typography variant="body2" fontWeight={700}>Size guide</Typography>
            <Typography variant="body2" color="text.secondary">{SPEC.hint} · {SPEC.formats}.</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{SPEC.appears}</Typography>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
