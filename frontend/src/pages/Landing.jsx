import BoltIcon from '@mui/icons-material/Bolt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
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
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { getHealth } from '../services/api.js';
import DashboardMock from '../components/landing/DashboardMock.jsx';
import PublicNav from '../components/landing/PublicNav.jsx';

const IMG_QR = 'https://lh3.googleusercontent.com/aida-public/AB6AXuC2BHCCOyEKtZUNCdoovPNw1Kmm4kR1U0OGTGTWeQSX5ruEblyN-bpyLbzESaCNRchJW77XadEZikvHQpdyj5zre7YDwQBThDZIvr7As0IvbQ-CdOf0fEfUIkKkEcq096IxAAiWjTcf9kzi1EEm2sp-CXxl3HnQBtyVvWX15oWSL4TNBgao9id_vX7F4_cTV-OJ0vwFS6CsfoGBFgjADeBi8N-7S__M5tibtkgAZ8eOWBxJC0F9qeHc';
const IMG_KDS = 'https://lh3.googleusercontent.com/aida-public/AB6AXuAa5YtpU9CzOoIqGaKW3Vn_uhCMOj2zxgrUuUDE2ACqLHWKO4fH22szIYaF0D3jS_ox6oBauO1YGxhbmVQuw_rj-bNmvcSXBoUcEDXak-olW3zn6wMhLXb-WqxE8EkujuoRkiZ3yPoNsRnv4dEiavo9cs-56k1UpZv74EVI_uemKHDcO3lTBfNZDQHt0aOc400t3EiHEDVWJ2CLKpsxRPuviWMvydcCvWd0tPutic0r3nDnkjz8koLy';
const IMG_UPI = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDEBCOfxWcEH4H4N72Kb5Uy-UmLIHVwcnZz5S42zgjigX76WtzOW0d6m3EKSRoOI4JGqnoK5CuDl3oqmIzoUxQWWD_kUNm_fT0lShSwr_bTowSZwrJY6Or5wvsGvmY44mmRn7V6Gl8-29hTYFPqc66G9WCj312x9jJ7r2SycRJATMIGFTtLb6hNMZr6lJVpkmvsY43FbefhLWwWplJE1lScW1O2OOlE8qRrYNQaL619vLx3bpVPy2ma';

const HERO_METRICS = [
  ['~40s', 'Average First Order'],
  ['0%', 'App Drop-off Rate'],
  ['24×7', 'Soundbox Acoustic Sync'],
  ['₹5.2 Cr+', 'Monthly Order GMV'],
];

const FEATURES = [
  {
    icon: 'qr_code_scanner', iconBg: '#FFDBD0', iconColor: '#C2410C',
    title: 'Instant Table QR Suite',
    body: 'Ultra-fast menu loading under 400ms even on congested 4G. Multi-guest collaborative carts, smart upsells, auto WhatsApp bills.',
    bullets: ['Zero app or registration required', 'Dynamic Veg/Non-Veg & Jain toggles', 'Collaborative table order sync'],
    metricLabel: 'Average Order Placement', metricValue: '⚡ 42 Seconds',
  },
  {
    icon: 'cooking', iconBg: '#99EFE5', iconColor: '#006A63',
    title: 'Real-Time KDS & Chef Display',
    body: 'Sub-second dockets to tandoor, curry and bar stations. Urgency timers catch bottlenecks. 86-toggle stops orders when dry.',
    bullets: ['Color-coded countdown tickets', 'Audio chimes for new orders', 'Multi-station auto-splitting'],
    metricLabel: 'Kitchen Error Reduction', metricValue: '📉 94% Drop',
  },
  {
    icon: 'tablet_android', iconBg: '#95F8A7', iconColor: '#00632B',
    title: 'Floor Captains & Waiter POS',
    body: 'Handheld table status, running orders, bill splits and cash collection right at the table.',
    bullets: ['Works on low-cost Android phones', 'One-tap table shifting & combining', 'Offline resilience on net drops'],
    metricLabel: 'Staff Walking Distance', metricValue: '🏃 -4.2 km/shift',
  },
  {
    icon: 'speaker_phone', iconBg: '#E9E1DD', iconColor: '#C2410C',
    title: 'Smart Soundbox & UPI Settler',
    body: 'Zero commission leak. Dynamic per-table UPI QR with acoustic confirmations in Hindi, Kannada, Tamil, English.',
    bullets: ['0% aggregator commission leak', 'PayTM, PhonePe & GPay boxes', 'Instant GST-compliant invoices'],
    metricLabel: 'Checkout Settlement', metricValue: '< 15 Seconds',
  },
];

const STEPS = [
  { n: '01', icon: 'qr_code_2', iconBg: '#FFDBD0', iconColor: '#C2410C', title: 'Guest Scans Dynamic QR', body: 'Rich photo menu opens instantly with Veg/Non-Veg, spice levels and customization.', img: IMG_QR, alt: 'QR table standee with butter chicken and naan' },
  { n: '02', icon: 'soup_kitchen', iconBg: '#99EFE5', iconColor: '#006A63', title: 'Kitchen Fires Instant KOT', body: 'Auto-routes to Curry, Tandoor, Pantry stations. Chimes alert chefs with timers.', img: IMG_KDS, alt: 'Commercial kitchen with KDS screen' },
  { n: '03', icon: 'payments', iconBg: '#95F8A7', iconColor: '#00632B', title: 'Direct UPI Pay & Faster Turn', body: 'One-tap UPI. Soundbox announces instantly, freeing tables 22% faster.', img: IMG_UPI, alt: 'UPI payment success with soundbox' },
];

const PLANS = [
  { name: 'Starter Plan', price: '₹999', per: '/ month', blurb: 'Small cafes, quick-service counters.', points: ['Up to 12 Dining Tables', '1 Restaurant Outlet', 'QR Ordering + Basic KDS', 'Daily settlement WhatsApp report'], cta: 'Get Starter Plan', hot: false },
  { name: 'Growth Plan', price: '₹1,999', per: '/ month', blurb: 'High-volume family dining & dhabas.', points: ['Up to 35 Tables', '2 Outlets Included', 'Multi-Station KDS (Curry/Tandoor/Bar)', 'Floor Captain Apps', 'Soundbox Voice Sync', 'Priority 24/7 Support'], cta: 'Start 14-Day Free Trial', hot: true },
  { name: 'Scale Plan', price: '₹2,999', per: '/ month', blurb: 'Multi-branch chains.', points: ['Unlimited Tables & Capacities', 'Multi-Branch Cloud Console', 'Custom Domain & White-label', 'Spices 86-Inventory Sync', 'Dedicated Account Manager'], cta: 'Contact Enterprise Sales', hot: false },
];

function StatusStrip() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getHealth().then(setHealth).catch((e) => setError(e.message));
  }, []);

  return (
    <Box id="status" sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#00632B' }} />
        <Typography variant="subtitle1" fontWeight={800} fontSize={14}>All Engine Systems Operational</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>• 99.99% Uptime SLA</Typography>
      </Box>
      <Box sx={{ flexGrow: 1 }} />
      {!health && !error && <CircularProgress size={18} />}
      {health && <Chip size="small" color="success" icon={<CheckCircleIcon />} label={`Operational · API ${health.status}`} />}
      {error && <Chip size="small" color="error" icon={<ErrorIcon />} label="Offline" />}
      {[['18ms', 'QR Edge :5173'], ['12ms', 'Engine Socket :8081'], ['0 Drop', 'Soundbox Webhook']].map(([v, l]) => (
        <Box key={l} sx={{ display: 'flex', gap: 1, px: 1.5, py: 0.75, borderRadius: 2, bgcolor: '#fff', boxShadow: 1, fontSize: 12 }}>
          <strong style={{ color: '#00632B' }}>{v}</strong><span>{l}</span>
        </Box>
      ))}
    </Box>
  );
}

function LeadForm() {
  const [sent, setSent] = useState(false);
  return (
    <Box
      component="form"
      onSubmit={(e) => { e.preventDefault(); setSent(true); }}
      sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, maxWidth: 480, mx: 'auto', width: '100%' }}
    >
      <TextField placeholder="Enter phone or restaurant name" required size="small" sx={{ flex: 1, bgcolor: '#fff', borderRadius: 2 }} />
      <Button type="submit" variant="contained" sx={{ bgcolor: '#fff', color: '#9B2F00', backgroundImage: 'none', borderRadius: 2, fontWeight: 800, '&:hover': { bgcolor: '#FFF5ED' } }}>
        Get Instant Access
      </Button>
      {sent && (
        <Typography variant="caption" sx={{ color: '#fff', width: '100%', textAlign: 'center' }}>
          🎉 Request received! Our team will call within 15 minutes. (visual only)
        </Typography>
      )}
    </Box>
  );
}

function Calculator() {
  const [n, setN] = useState(60);
  const extra = Math.round(n * 2.33);
  const lift = extra * 800;
  return (
    <Card sx={{ borderRadius: 2, mt: 4 }}>
      <CardContent>
        <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#9B2F00' }}>TABLEPULSE SAVINGS CALCULATOR</Typography>
        <Typography variant="h6" fontWeight={800}>Calculate monthly rush efficiency</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
          <Typography variant="body2" fontWeight={600}>Daily Dine-In Tables:</Typography>
          <Typography variant="body1" fontWeight={800} sx={{ color: '#9B2F00' }}>{n} Tables / Day</Typography>
        </Box>
        <input type="range" min={20} max={250} step={5} value={n} onChange={(e) => setN(Number(e.target.value))} style={{ width: '100%', accentColor: '#9B2F00' }} aria-label="Daily tables" />
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mt: 1 }}>
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#FAF2EE', textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">Extra Table Turns / Mo</Typography>
            <Typography variant="h6" fontWeight={800} sx={{ color: '#006A63' }}>+{extra} Turns</Typography>
          </Box>
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#FAF2EE', textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">Estimated Revenue Lift</Typography>
            <Typography variant="h6" fontWeight={800} sx={{ color: '#00632B' }}>₹{lift.toLocaleString('en-IN')}</Typography>
          </Box>
        </Box>
        <Typography variant="caption" color="text.secondary">Visual only — estimate at ₹800 avg ticket.</Typography>
      </CardContent>
    </Card>
  );
}

function StepPhoto({ src, alt }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <Box sx={{ height: 176, borderRadius: 2, background: 'linear-gradient(135deg, #FFE8D5, #FFDBD0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Typography variant="caption" color="text.secondary">Photo preview</Typography>
    </Box>;
  }
  return (
    <Box sx={{ height: 176, borderRadius: 2, overflow: 'hidden' }}>
      <Box component="img" src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </Box>
  );
}

export default function Landing() {
  return (
    <Box sx={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', bgcolor: '#FFF8F5', pt: { xs: '64px', lg: '80px' }, pb: { xs: '64px', md: 0 } }}>
      <PublicNav />
      <Box component="main" sx={{ flexGrow: 1 }}>
        <Box sx={{ color: '#fff', position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg, #340F04 0%, #7C2602 55%, #9B2F00 100%)', textAlign: 'center' }}>
          <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 }, position: 'relative' }}>
            <Chip
              icon={<BoltIcon sx={{ fontSize: 14 }} />}
              label="QR ORDERING & KITCHEN INTELLIGENCE OS • NO APP DOWNLOAD NEEDED"
              sx={{ mb: 2, bgcolor: 'rgba(255,255,255,.1)', color: '#FFDBD0', fontWeight: 700, fontSize: 10 }}
            />
            <Typography variant="h2" component="h1" sx={{ fontSize: { xs: 32, md: 40 }, maxWidth: 800, mx: 'auto', color: '#fff' }}>
              Turn every table into <Box component="span" sx={{ color: '#FFDBD0' }}>instant revenue</Box>
            </Typography>
            <Typography variant="body1" sx={{ mt: 2, maxWidth: 640, mx: 'auto', color: '#FFDBD0', opacity: 0.9, fontSize: 16 }}>
              Empower guests to scan, order, and pay in seconds. Sync table dockets to high-velocity KDS kitchen screens, floor captains, and instant soundbox settlements.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3, justifyContent: 'center' }}>
              <Button component={RouterLink} to="/register" variant="contained" size="large" startIcon={<BoltIcon />}
                sx={{ bgcolor: '#fff', color: '#9B2F00', backgroundImage: 'none', borderRadius: 2, height: 48, '&:hover': { bgcolor: '#FAF2EE' } }}>
                Start Free Trial — 14 Days Free
              </Button>
              <Button component={RouterLink} to="/login" variant="outlined" size="large" startIcon={<Avatar sx={{ width: 20, height: 20, bgcolor: 'transparent', fontSize: 14 }}>🏪</Avatar>}
                sx={{ color: '#fff', borderColor: 'rgba(255,255,255,.3)', borderRadius: 2, height: 48 }}>
                Login / Open Demo
              </Button>
            </Stack>
            <Box sx={{ mt: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,.1)', p: { xs: 2, sm: 3 }, display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, textAlign: 'left', maxWidth: 960, mx: 'auto' }}>
              {HERO_METRICS.map(([v, l]) => (
                <Box key={l}>
                  <Typography variant="h5" fontWeight={800}>{v}</Typography>
                  <Typography variant="caption" sx={{ color: '#FFDBD0' }}>{l}</Typography>
                </Box>
              ))}
            </Box>
          </Container>
        </Box>

        <Container maxWidth="lg" id="product" sx={{ mt: { xs: -4, sm: -6 }, position: 'relative', zIndex: 2, scrollMarginTop: 96 }}>
          <DashboardMock />
        </Container>

        <Box id="features" sx={{ bgcolor: '#FAF2EE', py: { xs: 5, md: 8 }, mt: 4, scrollMarginTop: 80 }}>
          <Container maxWidth="lg">
            <Typography variant="overline" color="primary.main" fontWeight={800} sx={{ display: 'block', textAlign: 'center' }}>
              Engineered for India&apos;s Fastest Dining Rooms
            </Typography>
            <Typography variant="h4" component="h2" sx={{ textAlign: 'center', mb: 1 }}>
              Everything your floor, kitchen, and cashier need to thrive
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', mb: 3, maxWidth: 720, mx: 'auto' }}>
              Eliminate lost checks, long wait times, and commission bleed with a synchronized restaurant OS.
            </Typography>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              {FEATURES.map((f) => (
                <Card key={f.title} sx={{ borderRadius: 2 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Avatar sx={{ bgcolor: f.iconBg, color: f.iconColor, mb: 2, borderRadius: 2, width: 48, height: 48 }}>
                      <Box component="span" className="material-symbols-outlined" sx={{ fontSize: 26 }}>{f.icon}</Box>
                    </Avatar>
                    <Typography variant="h6" fontWeight={800} fontSize={22}>{f.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{f.body}</Typography>
                    {f.bullets.map((b) => (
                      <Box key={b} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.75 }}>
                        <CheckCircleIcon fontSize="small" color="success" />
                        <Typography variant="body2">{b}</Typography>
                      </Box>
                    ))}
                    <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: '#FAF2EE', display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">{f.metricLabel}</Typography>
                      <Typography variant="body2" fontWeight={800}>{f.metricValue}</Typography>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Container>
        </Box>

        <Container maxWidth="lg" id="how" sx={{ py: { xs: 5, md: 8 }, scrollMarginTop: 80 }}>
          <Typography variant="overline" color="primary.main" fontWeight={800} sx={{ display: 'block', textAlign: 'center' }}>
            Simplicity at Velocity
          </Typography>
          <Typography variant="h4" component="h2" sx={{ textAlign: 'center', mb: 1 }}>
            How TablePulse powers your rush hour
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', mb: 3 }}>
            From the first guest scan to instant settlement — three steps that never fail.
          </Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
            {STEPS.map((s) => (
              <Card key={s.n} sx={{ borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h3" sx={{ position: 'absolute', top: 12, right: 16, color: '#E9E1DD', fontWeight: 800 }}>
                    {s.n}
                  </Typography>
                  <Avatar sx={{ bgcolor: s.iconBg, color: s.iconColor, mb: 2, borderRadius: 2, width: 48, height: 48 }}>
                    <Box component="span" className="material-symbols-outlined" sx={{ fontSize: 28 }}>{s.icon}</Box>
                  </Avatar>
                  <Typography variant="h6" fontWeight={800} fontSize={18}>{s.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{s.body}</Typography>
                  <StepPhoto src={s.img} alt={s.alt} />
                </CardContent>
              </Card>
            ))}
          </Box>
        </Container>

        <Box id="pricing" sx={{ bgcolor: '#F4ECE8', py: { xs: 5, md: 8 } }}>
          <Container maxWidth="lg">
            <Typography variant="overline" color="primary.main" fontWeight={800} sx={{ display: 'block', textAlign: 'center' }}>
              Simple, Fair Pricing
            </Typography>
            <Typography variant="h4" component="h2" sx={{ textAlign: 'center', mb: 1 }}>
              Zero commissions. Keep 100% of your earnings.
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', mb: 3 }}>
              No percentage cuts per order. Predictable monthly pricing.
            </Typography>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, alignItems: 'stretch' }}>
              {PLANS.map((p) => (
                <Card key={p.name} sx={{ borderRadius: 2, ...(p.hot ? { boxShadow: 6, position: 'relative', transform: { md: 'translateY(-12px)' } } : {}) }}>
                  {p.hot && <Chip label="🔥 Most Popular" color="primary" size="small" sx={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', fontWeight: 800 }} />}
                  <CardContent sx={{ p: 3, display: 'grid', gap: 1 }}>
                    <Typography variant="caption" fontWeight={800} sx={{ textTransform: 'uppercase', color: p.hot ? 'primary.main' : 'text.secondary' }}>
                      {p.name}
                    </Typography>
                    <Typography variant="h4" fontWeight={800}>
                      {p.price}<Typography component="span" variant="body2" color="text.secondary"> {p.per}</Typography>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">{p.blurb}</Typography>
                    {p.points.map((pt) => (
                      <Box key={pt} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <CheckCircleIcon fontSize="small" color="success" />
                        <Typography variant="body2">{pt}</Typography>
                      </Box>
                    ))}
                    <Button component={RouterLink} to="/register" variant={p.hot ? 'contained' : 'outlined'} sx={{ mt: 1, borderRadius: 2, height: 48, ...(p.hot && { backgroundImage: 'linear-gradient(90deg, #9B2F00, #C2410C)' }) }}>
                      {p.cta}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </Box>
            <Calculator />
          </Container>
        </Box>

        <Container maxWidth="lg">
          <StatusStrip />
        </Container>

        <Container maxWidth="md" sx={{ pb: { xs: 5, md: 8 } }}>
          <Card sx={{ color: '#fff', background: 'linear-gradient(90deg, #9B2F00, #C2410C)', textAlign: 'center', p: { xs: 3, md: 6 }, borderRadius: 2 }}>
            <CardContent>
              <Chip label="Zero Hardware Upfront" sx={{ bgcolor: 'rgba(255,255,255,.2)', color: '#fff', mb: 2, fontWeight: 700, fontSize: 10 }} />
              <Typography variant="h4" component="h2" gutterBottom>
                Ready to elevate your restaurant turnover?
              </Typography>
              <Typography variant="body1" sx={{ color: '#FFDBD0', mb: 3 }}>
                Deploy your QR menus and live KDS today. Free 14-day setup, menu digitised within 2 hours.
              </Typography>
              <LeadForm />
              <Typography variant="caption" sx={{ color: '#FFDBD0', display: 'block', mt: 1.5 }}>
                No credit card required • GST invoicing compliant • Free menu photography audit
              </Typography>
            </CardContent>
          </Card>
        </Container>
      </Box>

      <Box component="footer" sx={{ bgcolor: '#FAF2EE', pt: 5, pb: 3 }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr 1fr' }, pb: 3 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Avatar sx={{ bgcolor: '#C2410C', width: 32, height: 32, borderRadius: 2, fontWeight: 800 }}>T</Avatar>
                <Typography variant="h6" fontWeight={800}>Table<span style={{ color: '#C2410C' }}>Pulse</span></Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320 }}>
                Operating system and digital dining infrastructure for high-velocity Indian F&B.
              </Typography>
            </Box>
            {[
              ['Product', ['QR Smart Menu', 'KOT Kitchen Display', 'Captain POS Terminal', 'Pricing Packages', 'Network Status']],
              ['Solutions', ['High-Street Bistros', 'Heritage Dhabas', 'Multi-Outlet Chains', 'UPI & Bill Splitting', 'Inventory & Spices']],
              ['Legal & Trust', ['Privacy Policy', 'Terms of Service', 'Security Standards', 'GST Compliance', 'Contact Support']],
            ].map(([h, links]) => (
              <Box key={h}>
                <Typography variant="caption" fontWeight={800} sx={{ textTransform: 'uppercase', display: 'block', mb: 1 }}>
                  {h}
                </Typography>
                {links.map((l) => (
                  <Typography key={l} variant="body2" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    {l}
                  </Typography>
                ))}
              </Box>
            ))}
          </Box>
          <Box sx={{ pt: 2, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="caption" color="text.secondary">© 2025 TablePulse Technologies Pvt. Ltd. All rights reserved.</Typography>
            <Typography variant="caption" color="text.secondary">System Status · Documentation · Privacy</Typography>
          </Box>
        </Container>
      </Box>

      <Box
        component="nav"
        sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          bgcolor: 'rgba(255,248,245,0.9)',
          backdropFilter: 'blur(20px)',
          justifyContent: 'space-around',
          alignItems: 'center',
          height: 64,
        }}
      >
        {[
          ['cottage', 'Home', '#top', true],
          ['grid_view', 'Features', '#features', false],
          ['payments', 'Pricing', '#pricing', false],
          ['play_circle', 'Try Demo', '/login', false],
        ].map(([icon, label, href, active]) => (
          <Button
            key={label}
            href={href}
            sx={{ flexDirection: 'column', gap: 0, minWidth: 44, minHeight: 44, color: active ? 'primary.main' : 'text.secondary', fontWeight: active ? 800 : 400, fontSize: 10 }}
          >
            <Box component="span" className="material-symbols-outlined" sx={{ fontSize: 24 }}>{icon}</Box>
            {label}
          </Button>
        ))}
      </Box>
    </Box>
  );
}
