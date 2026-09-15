import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import KitchenIcon from '@mui/icons-material/SoupKitchen';
import PaymentsIcon from '@mui/icons-material/Payments';
import QrCodeIcon from '@mui/icons-material/QrCode2';
import TableBarIcon from '@mui/icons-material/TableBar';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { getHealth } from '../services/api.js';
import DashboardMock from '../components/landing/DashboardMock.jsx';
import PublicNav from '../components/landing/PublicNav.jsx';

const FEATURES = [
  {
    icon: <QrCodeIcon />,
    title: 'QR menus, zero app',
    body: 'Guests scan the table code and order from their phone. Nothing to install, nothing to learn, no waiter wait.',
  },
  {
    icon: <KitchenIcon />,
    title: 'Kitchen display that sings',
    body: 'Orders land on the KDS in real time with timers — accept, prepare, ready, served. No lost KOTs.',
  },
  {
    icon: <TableBarIcon />,
    title: 'Waiters always know',
    body: 'A live floor grid with ready-to-serve alerts. Food moves the second it is ready.',
  },
  {
    icon: <PaymentsIcon />,
    title: 'UPI checkout + analytics',
    body: 'Razorpay built in with pay-at-counter fallback — plus a dashboard owners actually open.',
  },
];

const STEPS = [
  { n: '01', title: 'Set up your restaurant', body: 'Branches, tables and a full menu with modifiers — done in one sitting.' },
  { n: '02', title: 'Stick QR codes on tables', body: 'Print per-table codes straight from TablePulse. T1 to T20 in one click.' },
  { n: '03', title: 'Watch orders fly', body: 'Kitchen, waiters and guests stay in sync automatically, rush hour included.' },
];

const PLANS = [
  { name: 'Starter', price: '₹999', per: '/month', blurb: 'Single outlet cafés getting digital.', points: ['1 branch · 15 tables', 'QR menu + ordering', 'Kitchen display', 'Email support'], cta: 'Start free', hot: false },
  { name: 'Growth', price: '₹1,999', per: '/month', blurb: 'Busy dine-ins that want it all.', points: ['3 branches · unlimited tables', 'Everything in Starter', 'UPI payments + analytics', 'Priority support'], cta: 'Start free', hot: true },
  { name: 'Scale', price: '₹2,999', per: '/month', blurb: 'Chains, food courts, cloud kitchens.', points: ['Unlimited branches', 'Everything in Growth', 'Multi-branch analytics', 'Dedicated manager'], cta: 'Talk to us', hot: false },
];

function StatusStrip() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getHealth().then(setHealth).catch((e) => setError(e.message));
  }, []);

  return (
    <Card id="status">
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="subtitle1" fontWeight={800}>
          System status
        </Typography>
        {!health && !error && <CircularProgress size={18} />}
        {health && <Chip size="small" color="success" icon={<CheckCircleIcon />} label={`Operational · API ${health.status}`} />}
        {error && <Chip size="small" color="error" icon={<ErrorIcon />} label="Offline" />}
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
          frontend :5173 → backend :8081
        </Typography>
      </CardContent>
    </Card>
  );
}

/** Public landing: in 10 seconds a visitor must get WHAT this is
 *  (QR ordering OS) and WHAT they'd see inside (the dashboard mock). */
export default function Landing() {
  return (
    <Box sx={{ minHeight: '100svh', display: 'flex', flexDirection: 'column' }}>
      <PublicNav />
      <Box component="main" sx={{ flexGrow: 1 }}>
        {/* HERO */}
        <Box
          sx={{
            color: '#fff',
            position: 'relative',
            overflow: 'hidden',
            background:
              'radial-gradient(110% 100% at 100% 0%, rgba(251,146,60,.5) 0%, rgba(234,88,12,0) 55%), linear-gradient(135deg, #431407 0%, #9a3412 60%, #c2410c 100%)',
          }}
        >
          <Container maxWidth="lg" sx={{ py: { xs: 7, md: 11 } }}>
            <Chip label="QR ordering OS for independent restaurants" sx={{ mb: 2.5, bgcolor: 'rgba(255,255,255,.15)', color: '#fff', fontWeight: 700 }} />
            <Typography variant="h2" component="h1" sx={{ fontSize: { xs: 36, md: 60 }, maxWidth: 720 }}>
              Turn every table into instant revenue.
            </Typography>
            <Typography variant="body1" sx={{ mt: 2, maxWidth: 600, opacity: 0.92, fontSize: { md: 18 } }}>
              TablePulse puts your menu, kitchen and billing on every guest&apos;s phone — they scan
              a QR, order in seconds and pay by UPI. Fewer errors, faster turns, bigger bills.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 4 }}>
              <Button component={RouterLink} to="/register" variant="contained" size="large" endIcon={<ArrowForwardIcon />}
                sx={{ bgcolor: '#fff', color: '#9a3412', backgroundImage: 'none', '&:hover': { bgcolor: '#fff7ed' } }}>
                Start free — register restaurant
              </Button>
              <Button component={RouterLink} to="/login" variant="outlined" size="large"
                sx={{ color: '#fff', borderColor: 'rgba(255,255,255,.5)', '&:hover': { borderColor: '#fff' } }}>
                Staff login
              </Button>
            </Stack>
            <Stack direction="row" spacing={4} sx={{ mt: 5, opacity: 0.92 }}>
              {[['~40s', 'scan → order'], ['0', 'app downloads'], ['24×7', 'kitchen sync']].map(([v, l]) => (
                <Box key={l}>
                  <Typography variant="h5" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>{v}</Typography>
                  <Typography variant="caption">{l}</Typography>
                </Box>
              ))}
            </Stack>
          </Container>
        </Box>

        <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 }, display: 'grid', gap: { xs: 5, md: 7 } }}>
          {/* PRODUCT MOCK */}
          <Box id="product" sx={{ scrollMarginTop: 80 }}>
            <Typography variant="overline" color="primary.main" fontWeight={800}>
              Peek inside
            </Typography>
            <Typography variant="h4" component="h2" sx={{ mb: 1 }}>
              This is what your floor looks like on TablePulse
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
              Revenue, live orders, top dishes and every table — on one screen, updating in real
              time. Preview below with sample data; yours lights up the day you go live.
            </Typography>
            <DashboardMock />
          </Box>

          {/* FEATURES */}
          <Box>
            <Typography variant="h4" component="h2" sx={{ mb: 0.5 }}>
              Everything between the door and the bill
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              One platform for guests, kitchen, waiters and owners.
            </Typography>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', xl: 'repeat(4, 1fr)' } }}>
              {FEATURES.map((f) => (
                <Card key={f.title} sx={{ height: '100%', transition: 'transform .2s, box-shadow .2s', '&:hover': { transform: 'translateY(-3px)', boxShadow: 5 } }}>
                  <CardContent>
                    <Avatar sx={{ bgcolor: 'primary.main', mb: 1.5, borderRadius: 3 }}>{f.icon}</Avatar>
                    <Typography variant="subtitle1" fontWeight={800} gutterBottom>{f.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{f.body}</Typography>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Box>

          {/* HOW IT WORKS */}
          <Box id="how" sx={{ scrollMarginTop: 80 }}>
            <Typography variant="h4" component="h2" sx={{ mb: 2 }}>
              Live in three steps
            </Typography>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
              {STEPS.map((s) => (
                <Card key={s.n}>
                  <CardContent>
                    <Typography variant="h4" color="primary.main" fontWeight={800}>{s.n}</Typography>
                    <Typography variant="subtitle1" fontWeight={800} sx={{ mt: 1 }}>{s.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{s.body}</Typography>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Box>

          {/* PRICING */}
          <Box id="pricing" sx={{ scrollMarginTop: 80 }}>
            <Typography variant="h4" component="h2" sx={{ mb: 0.5 }}>
              Pricing that pays for itself
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              One extra table-turn a day covers the month.
            </Typography>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, alignItems: 'stretch' }}>
              {PLANS.map((p) => (
                <Card
                  key={p.name}
                  sx={{
                    height: '100%',
                    ...(p.hot ? { border: 2, borderColor: 'primary.main', boxShadow: 5, position: 'relative' } : {}),
                  }}
                >
                  {p.hot && (
                    <Chip label="Most popular" color="primary" size="small"
                      sx={{ position: 'absolute', top: -12, left: 16, fontWeight: 800 }} />
                  )}
                  <CardContent sx={{ display: 'grid', gap: 1 }}>
                    <Typography variant="subtitle1" fontWeight={800}>{p.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{p.blurb}</Typography>
                    <Typography variant="h3" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {p.price}
                      <Typography component="span" variant="body2" color="text.secondary"> {p.per}</Typography>
                    </Typography>
                    <Box component="ul" sx={{ m: 0, pl: 2.5, display: 'grid', gap: 0.75 }}>
                      {p.points.map((pt) => (
                        <Typography component="li" variant="body2" key={pt}>{pt}</Typography>
                      ))}
                    </Box>
                    <Button component={RouterLink} to="/register" variant={p.hot ? 'contained' : 'outlined'} sx={{ mt: 1 }}>
                      {p.cta}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Box>

          <StatusStrip />

          {/* CTA */}
          <Card
            sx={{
              color: '#fff',
              background: 'linear-gradient(135deg, #431407 0%, #c2410c 100%)',
              textAlign: 'center',
              py: { xs: 4, md: 5 },
            }}
          >
            <CardContent>
              <Typography variant="h4" component="h2" gutterBottom>
                Your busiest Saturday is waiting.
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9, mb: 3 }}>
                Register your restaurant now — menu live before the dinner rush.
              </Typography>
              <Button component={RouterLink} to="/register" variant="contained" size="large" endIcon={<ArrowForwardIcon />}
                sx={{ bgcolor: '#fff', color: '#9a3412', backgroundImage: 'none', '&:hover': { bgcolor: '#fff7ed' } }}>
                Get started free
              </Button>
            </CardContent>
          </Card>
        </Container>
      </Box>

      <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider', py: 3, textAlign: 'center' }}>
        <Typography variant="body2" fontWeight={800}>🍽️ TablePulse</Typography>
        <Typography variant="caption" color="text.secondary">
          QR ordering OS for modern restaurants ·{' '}
          <RouterLink to="/login">Staff login</RouterLink> ·{' '}
          <RouterLink to="/register">Register restaurant</RouterLink>
        </Typography>
      </Box>
    </Box>
  );
}
