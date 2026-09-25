import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LinkIcon from '@mui/icons-material/Link';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import { useRef, useState } from 'react';

const SPECS = {
  logo: {
    title: 'Restaurant logo',
    shape: 'Square — 1:1',
    hint: 'Square image, at least 512 × 512 · PNG or JPG on a plain background',
    formats: 'JPEG, PNG or WebP · up to 5 MB',
    appears: 'Shown on your QR menu header, bills and staff screens.',
    goodTitle: 'Centered mark, plain background',
    goodBody: 'One logo, breathing room on all sides. Reads clearly even at bill size.',
    badTitle: 'Busy photo or full menu card',
    badBody: 'Small text and crowded backgrounds turn to noise at small sizes.',
  },
  cover: {
    title: 'Cover photo',
    shape: 'Landscape — 16:9',
    hint: 'Wide photo, at least 1600 × 900 · JPG under ~500 KB for fast loading',
    formats: 'JPEG, PNG or WebP · up to 5 MB',
    appears: 'Sits behind your restaurant name on the dashboard and directory.',
    goodTitle: 'Wide dining-room or food spread',
    goodBody: 'Fills the frame edge to edge. No small text — the name overlays it.',
    badTitle: 'Vertical portrait or blurry forward',
    badBody: 'Tall photos leave empty bands; blurred forwards look unprofessional.',
  },
};

function ExampleArt({ kind, good }) {
  if (kind === 'logo') {
    return (
      <Box
        sx={{
          aspectRatio: '1 / 1',
          borderRadius: 2,
          bgcolor: '#FAF2EE',
          border: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {good ? (
          <Box
            sx={{
              width: '44%',
              aspectRatio: '1 / 1',
              borderRadius: '50%',
              bgcolor: 'primary.container',
              color: 'primary.onContainer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              typography: 'h4',
              fontWeight: 800,
            }}
          >
            B
          </Box>
        ) : (
          <Box sx={{ width: '70%', display: 'grid', gap: 0.75, opacity: 0.75 }}>
            {[90, 100, 75, 95, 60].map((w, i) => (
              <Box key={i} sx={{ height: 7, width: `${w}%`, borderRadius: 1, bgcolor: 'text.disabled' }} />
            ))}
            <Box sx={{ height: 22, borderRadius: 1, bgcolor: 'text.disabled', opacity: 0.6 }} />
          </Box>
        )}
      </Box>
    );
  }
  return (
    <Box
      sx={{
        aspectRatio: '16 / 9',
        borderRadius: 2,
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
        position: 'relative',
        background: good
          ? 'linear-gradient(115deg, #7C2D12 0%, #C2410C 45%, #E8975A 78%, #F5D3AC 100%)'
          : '#EDE6E1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {good ? (
        <>
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: '46%',
              background: 'linear-gradient(180deg, transparent, rgba(30,10,2,.72))',
            }}
          />
          <Box sx={{ position: 'absolute', left: 12, bottom: 10, right: 12 }}>
            <Box sx={{ height: 10, width: '55%', borderRadius: 1, bgcolor: '#FFF8F5' }} />
            <Box sx={{ height: 7, width: '35%', borderRadius: 1, bgcolor: '#FFF8F5', opacity: 0.7, mt: 0.75 }} />
          </Box>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              bgcolor: 'rgba(255,248,245,.92)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9B2F00',
              fontWeight: 800,
              mb: 3,
            }}
          >
            ✦
          </Box>
        </>
      ) : (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', height: '100%', py: 1 }}>
          <Box sx={{ flex: 1, height: '100%', borderRadius: 1, bgcolor: '#D8CCC4', filter: 'blur(3px)' }} />
          <Box sx={{ width: '26%', height: '96%', borderRadius: 1, bgcolor: '#8D7168' }} />
          <Box sx={{ flex: 1, height: '100%', borderRadius: 1, bgcolor: '#D8CCC4', filter: 'blur(3px)' }} />
        </Box>
      )}
    </Box>
  );
}

const GUIDE_IMAGES = {
  logo: { good: '/guide/logo-good.jpg', bad: '/guide/logo-bad.jpg' },
  cover: { good: '/guide/cover-good.jpg', bad: '/guide/cover-bad.jpg' },
  dish: { good: '/guide/dish-good.jpg', bad: '/guide/dish-bad.jpg' },
};

export { GUIDE_IMAGES };

/** Guide figure: real photo when supplied, illustrated tile otherwise.
 *  badge='do' | 'avoid' renders the DO THIS / AVOID THIS watermark pill
 *  over the photo, matching the banners baked into the logo guide photos. */
export function GuideFigure({ kind, good, title, badge }) {
  const [missing, setMissing] = useState(false);
  const src = good ? GUIDE_IMAGES[kind].good : GUIDE_IMAGES[kind].bad;
  const art = missing ? (
    <ExampleArt kind={kind} good={good} />
  ) : (
    <Box
      component="img"
      src={src}
      alt={title}
      loading="lazy"
      decoding="async"
      onError={() => setMissing(true)}
      sx={{
        width: '100%',
        aspectRatio: kind === 'logo' ? '1 / 1' : kind === 'dish' ? '4 / 3' : '16 / 9',
        objectFit: 'cover',
        display: 'block',
        bgcolor: '#FAF2EE',
      }}
    />
  );
  if (!badge) return art;
  const doThis = badge === 'do';
  return (
    <Box sx={{ position: 'relative' }}>
      {art}
      <Typography
        variant="caption"
        fontWeight={800}
        sx={{
          position: 'absolute',
          top: 10,
          left: 10,
          px: 1.5,
          py: 0.5,
          borderRadius: 999,
          bgcolor: doThis ? '#1B7A3D' : '#C62828',
          color: '#fff',
          letterSpacing: '0.03em',
          boxShadow: '0 2px 8px rgba(0,0,0,.35)',
          fontSize: 11,
        }}
      >
        {doThis ? '✓ DO THIS (Recommended)' : '✕ AVOID THIS (Will be Rejected)'}
      </Typography>
    </Box>
  );
}

/**
 * Premium image field: Upload (device) + Link tabs, live preview shaped like
 * the final surface, and a word-based photo guide (no tick/cross iconography).
 *
 * Guide photos live in frontend/public/guide/ (logo-good.jpg, logo-bad.jpg,
 * cover-good.jpg, cover-bad.jpg). Any missing file falls back to the built-in
 * illustrated tile — never a broken image.
 *
 * onPickFile(file) must resolve to a display URL. For a saved restaurant pass
 * an uploader hitting the backend; for a not-yet-created restaurant pass a
 * handler that returns a local preview and stashes the File for later upload.
 */
export default function ImagePicker({ kind = 'logo', value, onChange, onPickFile, disabled }) {
  const spec = SPECS[kind];
  const [tab, setTab] = useState('upload');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const fileRef = useRef(null);

  async function handleFile(file) {
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
    setBusy(true);
    try {
      const url = await onPickFile(file);
      if (url) onChange(url);
    } catch (e) {
      setError(e.message || 'Upload failed. Try the link option instead.');
    } finally {
      setBusy(false);
    }
  }

  function applyLink() {
    const url = link.trim();
    if (!/^https?:\/\/.+\..+/.test(url)) {
      setError('Paste a full image link starting with http(s)://');
      return;
    }
    setError(null);
    onChange(url);
  }

  return (
    <Box sx={{ minWidth: 0 }}>
      {/* Stacked header: never squeezes in narrow columns */}
      <Box sx={{ mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" fontWeight={800}>{spec.title}</Typography>
          <Typography variant="caption" color="text.secondary">{spec.shape}</Typography>
        </Box>
        <Button
          size="small"
          startIcon={<InfoOutlinedIcon fontSize="small" />}
          onClick={() => setGuideOpen(true)}
          sx={{ textTransform: 'none', fontWeight: 700, px: 0, minHeight: 0, mt: 0.25 }}
        >
          What makes a good photo?
        </Button>
      </Box>

      {/* Preview on top, controls below — never squeezes at any width */}
      <Box
        sx={{
          aspectRatio: kind === 'logo' ? '1 / 1' : '16 / 9',
          maxHeight: kind === 'logo' ? 220 : 260,
          width: kind === 'logo' ? { xs: '100%', sm: 240 } : '100%',
          borderRadius: 2,
          overflow: 'hidden',
          position: 'relative',
          bgcolor: '#FAF2EE',
          border: 1,
          borderColor: 'divider',
          mb: 1,
        }}
      >
        {value ? (
          <Box
            component="img"
            src={value}
            alt={spec.title}
            onError={() => setError('That image could not be loaded. Check the link or try another file.')}
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <Box
            sx={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 0.5, color: 'text.disabled',
            }}
          >
            <PhotoCameraIcon fontSize="large" />
            <Typography variant="caption">No {kind} yet</Typography>
          </Box>
        )}
        {value && !disabled && (
          <IconButton
            size="small"
            aria-label={`Remove ${kind}`}
            onClick={() => onChange('')}
            sx={{ position: 'absolute', top: 6, right: 6, bgcolor: 'rgba(30,27,25,.55)', color: '#fff', '&:hover': { bgcolor: 'rgba(30,27,25,.75)' } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
        {busy && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,248,245,.7)' }}>
            <CircularProgress size={28} />
          </Box>
        )}
      </Box>

      {/* Upload / Link segmented control */}
      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        {[
          { id: 'upload', label: 'Upload', icon: <CloudUploadIcon fontSize="small" /> },
          { id: 'link', label: 'Link', icon: <LinkIcon fontSize="small" /> },
        ].map((t) => (
          <Button
            key={t.id}
            size="small"
            startIcon={t.icon}
            variant={tab === t.id ? 'contained' : 'outlined'}
            onClick={() => { setTab(t.id); setError(null); }}
            disabled={disabled}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
          >
            {t.label}
          </Button>
        ))}
      </Box>

      {tab === 'upload' ? (
        <Box
          onClick={() => !disabled && !busy && fileRef.current?.click()}
          sx={{
            border: 1.5,
            borderStyle: 'dashed',
            borderColor: 'divider',
            borderRadius: 2,
            p: 2,
            textAlign: 'center',
            cursor: disabled ? 'default' : 'pointer',
            bgcolor: '#FFFDFB',
            '&:hover': disabled ? {} : { borderColor: 'primary.main', bgcolor: '#FFF8F5' },
          }}
        >
          <Typography variant="body2" fontWeight={700}>
            {busy ? 'Reading image…' : 'Choose from this device'}
          </Typography>
          <Typography variant="caption" color="text.secondary">{spec.formats}</Typography>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
          />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="https://your-site.com/photo.jpg"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            disabled={disabled}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FFFDFB' } }}
          />
          <Button variant="outlined" onClick={applyLink} disabled={disabled} sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', flexShrink: 0 }}>
            Use link
          </Button>
        </Box>
      )}

      {error && <Alert severity="warning" sx={{ mt: 1 }} onClose={() => setError(null)}>{error}</Alert>}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
        {spec.hint}
      </Typography>

      {/* Photo guide — tonal word-based cards, premium look */}
      <Dialog open={guideOpen} onClose={() => setGuideOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={800}>What makes a good {kind} photo?</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
              <GuideFigure kind={kind} good title={spec.goodTitle} badge="do" />
              <Box sx={{ p: 1.5 }}>
                <Typography
                  variant="caption"
                  fontWeight={800}
                  sx={{
                    display: 'inline-block', px: 1.25, py: 0.25, borderRadius: 999,
                    bgcolor: '#E4F3E5', color: '#1B5E20', letterSpacing: '0.04em',
                  }}
                >
                  RECOMMENDED
                </Typography>
                <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 1 }}>{spec.goodTitle}</Typography>
                <Typography variant="body2" color="text.secondary">{spec.goodBody}</Typography>
              </Box>
            </Box>
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
              <GuideFigure kind={kind} title={spec.badTitle} badge="avoid" />
              <Box sx={{ p: 1.5 }}>
                <Typography
                  variant="caption"
                  fontWeight={800}
                  sx={{
                    display: 'inline-block', px: 1.25, py: 0.25, borderRadius: 999,
                    bgcolor: '#EFE7E2', color: '#6D4C41', letterSpacing: '0.04em',
                  }}
                >
                  NOT IDEAL
                </Typography>
                <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 1 }}>{spec.badTitle}</Typography>
                <Typography variant="body2" color="text.secondary">{spec.badBody}</Typography>
              </Box>
            </Box>
          </Box>
          <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: '#FFF8F5', border: 1, borderColor: 'divider' }}>
            <Typography variant="body2" fontWeight={700}>Size guide</Typography>
            <Typography variant="body2" color="text.secondary">{spec.hint} · {spec.formats}.</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{spec.appears}</Typography>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
