import { Avatar, Box, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import ModeToggle from '../ModeToggle.jsx';

const LINKS = [
  { label: 'Product', href: '#product', active: true },
  { label: 'Features', href: '#features' },
  { label: 'How it Works', href: '#how' },
  { label: 'Pricing', href: '#pricing' },
];

/** Stitch-exact fixed header: h-20 desktop, h-16 mobile. */
export default function PublicNav() {
  const { user } = useAuth();

  return (
    <Box
      component="header"
      sx={(t) => ({
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        backdropFilter: 'blur(20px)',
        backgroundColor:
          t.palette.mode === 'light' ? 'rgba(255,248,245,0.85)' : 'rgba(20,17,16,0.85)',
        boxShadow: '0 1px 8px rgba(28,25,23,0.06)',
      })}
    >
      <Box
        sx={{
          height: { xs: 64, lg: 80 },
          maxWidth: 1280,
          mx: 'auto',
          width: '100%',
          px: { xs: 2, md: 3, lg: 4 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Box
            component={RouterLink}
            to="/"
            sx={{ display: 'flex', alignItems: 'center', gap: 1.25, textDecoration: 'none', color: 'inherit' }}
          >
            <Avatar
              sx={{
                bgcolor: '#C2410C',
                fontWeight: 800,
                width: 40,
                height: 40,
                borderRadius: 2,
                fontSize: 20,
                boxShadow: '0 4px 12px -2px rgba(194,65,12,0.25)',
              }}
            >
              T
            </Avatar>
            <Box
              sx={{ fontWeight: 600, fontSize: 18, letterSpacing: '-0.01em', display: { xs: 'none', sm: 'block' } }}
            >
              Table<span style={{ color: '#C2410C' }}>Pulse</span>
            </Box>
          </Box>
          <Box sx={{ display: { xs: 'none', lg: 'flex' }, alignItems: 'center', gap: 2.5 }}>
            {LINKS.map((l) => (
              <Button
                key={l.label}
                href={l.href}
                sx={
                  l.active
                    ? { fontWeight: 800, color: 'primary.main', bgcolor: '#EEE7E3', borderRadius: 2, px: 1.5, py: 0.75 }
                    : { fontWeight: 600, fontSize: 14, color: 'text.secondary' }
                }
              >
                {l.label}
              </Button>
            ))}
            <Button href="#status" sx={{ fontWeight: 600, fontSize: 14, color: 'text.secondary', gap: 1 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#117E3B' }} />
              Live Status
            </Button>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ModeToggle />
          {!user && (
            <Button
              component={RouterLink}
              to="/login"
              sx={{
                display: { xs: 'none', sm: 'inline-flex' },
                height: 44,
                px: 2.5,
                borderRadius: 2,
                bgcolor: '#FAF2EE',
                color: '#C2410C',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Login
            </Button>
          )}
          <Button
            component={RouterLink}
            to={user ? '/admin' : '/register'}
            variant="contained"
            sx={{
              height: 44,
              px: 2.5,
              borderRadius: 2,
              fontWeight: 600,
              fontSize: 14,
              backgroundImage: 'linear-gradient(90deg, #9B2F00, #C2410C)',
              boxShadow: '0 4px 14px -2px rgba(194,65,12,0.35)',
            }}
          >
            {user ? 'Open dashboard' : 'Start Free Trial'}
          </Button>
          <Avatar sx={{ bgcolor: '#9B2F00', width: 32, height: 32 }}>
            <Box component="span" className="material-symbols-outlined" sx={{ fontSize: 18, color: '#fff' }}>
              person
            </Box>
          </Avatar>
        </Box>
      </Box>
    </Box>
  );
}
