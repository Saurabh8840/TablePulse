import { Box, Button, Typography } from '@mui/material';
import { useState } from 'react';
import ImagePicker from './ImagePicker.jsx';

/**
 * Settings image stepper: Step 1 = restaurant logo, Step 2 = cover photo.
 * One picker visible at a time so narrow cards never squeeze or overlap.
 */
export default function ImageStepPicker({
  logoUrl, coverUrl, onLogo, onCover, onPickLogo, onPickCover,
}) {
  const [step, setStep] = useState(0);

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        {['Step 1 · Logo', 'Step 2 · Cover'].map((label, i) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              size="small"
              variant={step === i ? 'contained' : 'outlined'}
              onClick={() => setStep(i)}
              sx={{ borderRadius: 999, fontWeight: 800, textTransform: 'none' }}
            >
              {label}
            </Button>
            {i === 0 && (
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {[0, 1].map((d) => (
                  <Box
                    key={d}
                    onClick={() => setStep(d)}
                    sx={{
                      width: 20, height: 6, borderRadius: 999, cursor: 'pointer',
                      bgcolor: step === d ? 'primary.main' : 'action.hover',
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>
        ))}
        {(logoUrl || coverUrl) && (
          <Typography variant="caption" color="success.main" fontWeight={800} sx={{ ml: 'auto' }}>
            {[logoUrl && '✓ Logo', coverUrl && '✓ Cover'].filter(Boolean).join(' · ')}
          </Typography>
        )}
      </Box>

      {step === 0 ? (
        <ImagePicker kind="logo" value={logoUrl} onChange={onLogo} onPickFile={onPickLogo} />
      ) : (
        <ImagePicker kind="cover" value={coverUrl} onChange={onCover} onPickFile={onPickCover} />
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5 }}>
        <Button size="small" disabled={step === 0} onClick={() => setStep(0)} sx={{ fontWeight: 700 }}>
          ← Back to logo
        </Button>
        {step === 0 ? (
          <Button size="small" variant="outlined" onClick={() => setStep(1)} sx={{ borderRadius: 2, fontWeight: 800 }}>
            Next: cover photo →
          </Button>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
            Both images save instantly.
          </Typography>
        )}
      </Box>
    </Box>
  );
}
