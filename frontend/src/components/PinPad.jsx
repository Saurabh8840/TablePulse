import { Box, Button } from '@mui/material';
import { useState } from 'react';

/** Shared 4-digit PIN pad UI (Stitch-exact). Validation is wired by the
 *  parent via onComplete — the pad itself never authenticates anything. */
export default function PinPad({ onComplete, accent = '#C2410C' }) {
  const [pin, setPin] = useState('');

  const press = (d) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      const v = next;
      setTimeout(() => {
        setPin('');
        onComplete?.(v);
      }, 180);
    }
  };

  const clear = () => setPin('');
  const back = () => setPin((p) => p.slice(0, -1));

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 0.5 }}>
        {[0, 1, 2, 3].map((i) => (
          <Box
            key={i}
            sx={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              bgcolor: i < pin.length ? accent : '#E9E1DD',
              transform: i < pin.length ? 'scale(1.25)' : 'none',
              transition: 'all .15s',
            }}
          />
        ))}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mt: 2, maxWidth: 340, mx: 'auto' }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Button
            key={d}
            onClick={() => press(d)}
            sx={{
              height: 56,
              borderRadius: 2,
              bgcolor: '#FAF2EE',
              color: '#1E1B19',
              fontWeight: 800,
              fontSize: 22,
              '&:hover': { bgcolor: '#F4ECE8' },
            }}
          >
            {d}
          </Button>
        ))}
        <Button
          onClick={clear}
          sx={{ height: 56, borderRadius: 2, bgcolor: '#F4ECE8', color: 'text.secondary', fontWeight: 800, fontSize: 12 }}
        >
          CLR
        </Button>
        <Button
          onClick={() => press('0')}
          sx={{ height: 56, borderRadius: 2, bgcolor: '#FAF2EE', color: '#1E1B19', fontWeight: 800, fontSize: 22, '&:hover': { bgcolor: '#F4ECE8' } }}
        >
          0
        </Button>
        <Button
          onClick={back}
          aria-label="Backspace"
          sx={{ height: 56, borderRadius: 2, bgcolor: '#F4ECE8', color: 'text.secondary' }}
        >
          <Box component="span" className="material-symbols-outlined" sx={{ fontSize: 20 }}>
            backspace
          </Box>
        </Button>
      </Box>
    </Box>
  );
}
