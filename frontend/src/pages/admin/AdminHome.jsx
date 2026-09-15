import CurrencyRupeeIcon from '@mui/icons-material/CurrencyRupee';
import LogoutIcon from '@mui/icons-material/Logout';
import QrCodeIcon from '@mui/icons-material/QrCode2';
import ReceiptIcon from '@mui/icons-material/Receipt';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import TableBarIcon from '@mui/icons-material/TableBar';
import TimerIcon from '@mui/icons-material/Timer';
import { Box, Button, Card, CardContent, Chip, CircularProgress, Typography } from '@mui/material';
import { Navigate, Link as RouterLink } from 'react-router-dom';
import EmptyState from '../../components/EmptyState.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import StatCard from '../../components/StatCard.jsx';
import { useAuth } from '../../hooks/useAuth.js';

const QUICK_ACTIONS = [
  { icon: <RestaurantMenuIcon />, label: 'Build menu', hint: 'Categories & items', to: '/admin/restaurants' },
  { icon: <TableBarIcon />, label: 'Add tables', hint: 'Bulk + QR', to: '/admin/restaurants' },
  { icon: <QrCodeIcon />, label: 'Print QR codes', hint: 'Per table PNG', to: '/admin/restaurants' },
  { icon: <ReceiptIcon />, label: 'View orders', hint: 'Phase 3', to: '/admin', disabled: true },
];

export default function AdminHome() {
  const { user, loading, logout } = useAuth();

  if (loading) return <CircularProgress />;
  if (!user) return <Navigate to="/login" replace />;

  const firstName = user.fullName?.split(' ')[0] ?? 'Owner';

  return (
    <Box>
      <PageHeader
        title={`Namaste, ${firstName} 👋`}
        subtitle="Here's what's happening at your restaurant today."
        actions={
          <Button variant="outlined" startIcon={<LogoutIcon />} onClick={logout}>
            Sign out
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<CurrencyRupeeIcon />} label="Today's revenue" value="—" hint="Live in Phase 7" />
        <StatCard icon={<ReceiptIcon />} label="Orders today" value="—" hint="Live in Phase 3" />
        <StatCard icon={<TableBarIcon />} label="Active tables" value="—" hint="Live in Phase 5" />
        <StatCard icon={<TimerIcon />} label="Avg. prep time" value="—" hint="Live in Phase 7" />
      </div>

      <div className="grid gap-4 mt-4 lg:grid-cols-5">
        <Box sx={{ gridColumn: { lg: 'span 3' } }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="h6">Get set up</Typography>
                <Chip label="Ready to use" size="small" color="success" variant="outlined" />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                Three steps and your floor is digital. Start from Restaurants.
              </Typography>
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                {[
                  ['1', 'Create your restaurant & branch', 'Name, address, hours, taxes.'],
                  ['2', 'Add tables & print QR codes', 'Bulk-create T1–T20 in one click.'],
                  ['3', 'Build the menu', 'Categories, items, modifiers, photos.'],
                ].map(([n, t, b]) => (
                  <Box
                    key={n}
                    sx={{
                      display: 'flex',
                      gap: 2,
                      p: 2,
                      borderRadius: 3,
                      border: 1,
                      borderColor: 'divider',
                      bgcolor: 'background.default',
                    }}
                  >
                    <Typography variant="h6" color="primary.main" fontWeight={800}>
                      {n}
                    </Typography>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={800}>
                        {t}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {b}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ gridColumn: { lg: 'span 2' }, display: 'grid', gap: 2, alignContent: 'start' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Quick actions
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                {QUICK_ACTIONS.map((a) => (
                  <Button
                    key={a.label}
                    component={RouterLink}
                    to={a.to}
                    variant="outlined"
                    disabled={a.disabled}
                    sx={{ flexDirection: 'column', gap: 0.5, py: 2, textTransform: 'none' }}
                  >
                    {a.icon}
                    <Typography variant="body2" fontWeight={700}>
                      {a.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {a.hint}
                    </Typography>
                  </Button>
                ))}
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Signed in as
              </Typography>
              <Typography variant="subtitle1" fontWeight={800}>
                {user.fullName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user.email} · {user.role}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                tenant {user.tenantId}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </div>

      <Box sx={{ mt: 2 }}>
        <EmptyState
          icon="🧾"
          title="No orders yet"
          body="Once guests start scanning your table codes, live orders will stream in here with kitchen and waiter updates."
        />
      </Box>
    </Box>
  );
}
