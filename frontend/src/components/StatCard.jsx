import { Avatar, Box, Card, CardContent, Typography } from '@mui/material';

/** SaaS metric tile: icon, label, big value, delta caption.
 *  `hint` marks data that wires up in a later phase (honest placeholder). */
export default function StatCard({ icon, label, value, delta, hint }) {
  return (
    <Card sx={{ height: '100%', transition: 'transform .2s, box-shadow .2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 } }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40, borderRadius: 3 }}>{icon}</Avatar>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            {label}
          </Typography>
        </Box>
        <Typography variant="h4" component="p">
          {value}
        </Typography>
        {(delta || hint) && (
          <Typography variant="caption" color={hint ? 'text.secondary' : 'success.main'} fontWeight={600}>
            {hint ?? delta}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
