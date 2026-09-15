import BoltIcon from '@mui/icons-material/Bolt';
import PaymentsIcon from '@mui/icons-material/Payments';
import QrCodeIcon from '@mui/icons-material/QrCode2';
import { Avatar, Box, Stack, Typography } from '@mui/material';

/** Left brand panel for auth screens: gradient, pitch, mini feature list. */
const POINTS = [
  { icon: <QrCodeIcon />, title: 'QR menus in minutes', body: 'Print codes, stick them on tables, done.' },
  { icon: <BoltIcon />, title: 'Orders hit the kitchen live', body: 'Real-time KDS with accept → ready flow.' },
  { icon: <PaymentsIcon />, title: 'UPI checkout built in', body: 'Razorpay + pay-at-counter, one bill.' },
];

export default function BrandPanel() {
  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 520,
        borderRadius: 5,
        p: { xs: 3, md: 4 },
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 3,
        background:
          'radial-gradient(120% 90% at 100% 0%, rgba(251,146,60,.55) 0%, rgba(234,88,12,0) 55%), radial-gradient(100% 100% at 0% 100%, rgba(15,118,110,.5) 0%, rgba(15,118,110,0) 50%), linear-gradient(135deg, #7c2d12 0%, #c2410c 55%, #9a3412 100%)',
        boxShadow: 6,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box>
        <Typography variant="overline" sx={{ opacity: 0.85, fontWeight: 700 }}>
          TablePulse for restaurants
        </Typography>
        <Typography variant="h4" component="p" sx={{ mt: 1, fontWeight: 800 }}>
          Every table,
          <br />
          an instant ordering station.
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
          Scan → order → kitchen → pay. No app download, no waiting for waiters.
        </Typography>
      </Box>
      <Stack spacing={2}>
        {POINTS.map((p) => (
          <Box key={p.title} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,.18)', width: 40, height: 40, borderRadius: 3 }}>
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
      </Stack>
      <Typography variant="caption" sx={{ opacity: 0.75 }}>
        Loved by busy cafés, restro-bars and cloud kitchens.
      </Typography>
    </Box>
  );
}
