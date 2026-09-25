import QrCodeIcon from '@mui/icons-material/QrCode2';
import DevicesIcon from '@mui/icons-material/Devices';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import PercentIcon from '@mui/icons-material/Percent';
import SoupKitchenIcon from '@mui/icons-material/SoupKitchen';
import VerifiedIcon from '@mui/icons-material/Verified';
import { Avatar, Box, Typography } from '@mui/material';

const LOGIN_POINTS = [
  { icon: <QrCodeIcon />, title: 'Instant 400ms QR Menu', body: 'Diners scan acrylic stands, customize items, and fire orders directly to KDS.' },
  { icon: <SoupKitchenIcon />, title: 'Smart Station Routing', body: 'Real-time KDS dispatch to Tandoor, Curry, and Mocktail bars with countdown clocks.' },
  { icon: <VolumeUpIcon />, title: 'Soundbox Settlements', body: 'Zero-commission direct UPI collection with Hindi & English instant audio confirmations.' },
];

const REGISTER_POINTS = [
  { icon: <QrCodeIcon />, title: 'Free Custom QR Acrylic Stands', body: 'Delivered to your doorstep within 48 hours, waterproof & smudge-proof.' },
  { icon: <PercentIcon />, title: 'Zero Onboarding Fees', body: 'No upfront setup cost or per-order commissions. Keep 100% straight to UPI/Bank.' },
  { icon: <DevicesIcon />, title: 'Multi-Device Ready', body: 'Runs on Android tablets, captain phones, and ESC/POS thermal kitchen printers.' },
];

/** Stitch-style terracotta brand panel. variant: login | register */
export default function BrandPanel({ variant = 'login' }) {
  const isLogin = variant === 'login';
  const points = isLogin ? LOGIN_POINTS : REGISTER_POINTS;

  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 560,
        borderRadius: 2,
        p: { xs: 3, md: 4 },
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 3,
        background:
          'radial-gradient(120% 90% at 100% 0%, rgba(251,146,60,.35) 0%, rgba(234,88,12,0) 55%), linear-gradient(135deg, #9B2F00 0%, #C2410C 55%, #7C2602 100%)',
        boxShadow: 6,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 0.5,
            borderRadius: 999,
            bgcolor: 'rgba(255,255,255,.15)',
            mb: 2,
          }}
        >
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#95F8A7' }} />
          <Typography variant="caption" fontWeight={700} sx={{ letterSpacing: '.08em' }}>
            {isLogin ? 'RESTAURANT OS & QR CLOUD' : 'JOIN 400+ RESTAURANTS'}
          </Typography>
        </Box>
        <Typography variant="h4" component="p" sx={{ fontWeight: 800, lineHeight: 1.15 }}>
          {isLogin ? (
            <>Run high-turnover dining rooms with zero lag.</>
          ) : (
            <>Launch your QR dining and cloud kitchen in 15 minutes.</>
          )}
        </Typography>
        {!isLogin && (
          <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
            Engineered for high-velocity Indian eateries, dhabas, and premium cafes.
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'grid', gap: 1.5 }}>
        {points.map((p) => (
          <Box
            key={p.title}
            sx={{
              display: 'flex',
              gap: 1.5,
              alignItems: 'flex-start',
              p: 1.75,
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,.1)',
            }}
          >
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,.15)', width: 40, height: 40, borderRadius: 3 }}>
              {p.icon}
            </Avatar>
            <Box>
              <Typography variant="subtitle2" fontWeight={800}>
                {p.title}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                {p.body}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1.5,
          borderRadius: 3,
          bgcolor: 'rgba(255,255,255,.15)',
        }}
      >
        <VerifiedIcon fontSize="small" />
        <Typography variant="body2" fontWeight={600}>
          {isLogin ? (
            <>Processed over <strong>₹5.2 Cr+</strong> across 400+ Indian bistros & dhabas</>
          ) : (
            <>4.9/5 Pilot Rating — turnaround dropped by 22 mins at Indiranagar outlet</>
          )}
        </Typography>
      </Box>
    </Box>
  );
}
