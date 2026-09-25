import { Box, Card, Chip, Typography } from '@mui/material';

const STATS = [
  { label: 'Gross Daily Revenue', value: '₹74,850', sub: '+18.4% vs last week', subColor: '#00632B', icon: 'currency_rupee', iconBg: '#FFDBD0', iconColor: '#C2410C' },
  { label: 'Table Occupancy', value: '18 / 24', sub: '75% Capacity Filled', subColor: '#59413A', icon: 'table_restaurant', iconBg: '#99EFE5', iconColor: '#006A63', dot: '#006A63' },
  { label: 'Active Kitchen Load', value: '7 Live KOTs', sub: '1 KOT delayed >12m', subColor: '#BA1A1A', icon: 'soup_kitchen', iconBg: '#FFDBD0', iconColor: '#9B2F00' },
  { label: 'Average Turn Time', value: '38 min', sub: '-9 mins vs paper order', subColor: '#00632B', icon: 'timelapse', iconBg: '#95F8A7', iconColor: '#00632B' },
];

const BARS = [
  ['Mon', 48], ['Tue', 60], ['Wed', 52], ['Thu', 75], ['Fri', 92], ['Sat', 100], ['Sun', 88],
];

const DISHES = [
  { name: 'Paneer Butter Masala', orders: '142 orders', pct: 85, veg: '#15803D' },
  { name: 'Murgh Dum Biryani', orders: '119 orders', pct: 72, veg: '#BA1A1A' },
  { name: 'Degree Filter Coffee', orders: '88 orders', pct: 55, veg: '#15803D' },
];

const FLOOR = [
  { t: 'T-01', amt: '₹1,840', sub: '4 Guests • 22m', dot: '#006A63', bold: false },
  { t: 'T-02', amt: '₹920', sub: '2 Guests • 14m', dot: '#006A63', bold: false },
  { t: 'T-03', amt: 'Bill Sent', sub: 'UPI QR Split', dot: '#C2410C', bold: true },
  { t: 'T-04', amt: 'In Cart (3)', sub: 'Ordering...', dot: '#117E3B', bold: false },
  { t: 'T-05', amt: '₹3,450', sub: '6 Guests • 31m', dot: '#006A63', bold: false },
  { t: 'T-06', amt: 'Vacant', sub: 'Cleaned', dot: '#E1BFB5', bold: false },
  { t: 'T-07', amt: 'Delayed', sub: 'KDS 14m+', dot: '#BA1A1A', bold: true, warn: true },
  { t: 'T-08', amt: '₹1,120', sub: '3 Guests • 9m', dot: '#006A63', bold: false },
];

export default function DashboardMock() {
  return (
    <Card elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', boxShadow: 8, border: 1, borderColor: 'divider' }}>
      <Box sx={{ height: 48, bgcolor: '#F4ECE8', px: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          {['#f87171', '#fbbf24', '#34d399'].map((c) => (
            <Box key={c} sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: c }} />
          ))}
        </Box>
        <Box sx={{ px: 2, py: 0.5, borderRadius: 999, bgcolor: '#E9E1DD', fontSize: 12, color: '#59413A', display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box component="span" className="material-symbols-outlined" sx={{ fontSize: 14 }}>lock</Box>
          tablepulse.com/admin/live-matrix
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip size="small" label="LIVE PREVIEW" sx={{ bgcolor: '#99EFE5', color: '#006F67', fontWeight: 800, fontSize: 10 }} />
          <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>
            Koramangala 4th Block
          </Typography>
        </Box>
      </Box>

      <Box sx={{ p: { xs: 2, sm: 2.5, lg: 3 }, display: 'grid', gap: 2, bgcolor: '#FFF8F5' }}>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
          {STATS.map((s) => (
              <Box key={s.label} sx={{ bgcolor: '#fff', p: 2, borderRadius: 2, boxShadow: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} fontSize={12}>
                  {s.label}
                </Typography>
                <Box
                  component="span"
                  className="material-symbols-outlined"
                  sx={{ fontSize: 20, color: s.iconColor, bgcolor: s.iconBg, width: 32, height: 32, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {s.icon}
                </Box>
              </Box>
              <Typography variant="h5" fontWeight={800} sx={{ fontSize: 28, mt: 1 }}>
                {s.value}
              </Typography>
              <Typography variant="caption" fontWeight={600} sx={{ color: s.subColor, display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                {s.dot && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.dot }} />}
                {s.sub}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' } }}>
          <Box sx={{ bgcolor: '#fff', p: { xs: 2, sm: 2.5 }, borderRadius: 2, boxShadow: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700} fontSize={18}>7-Day Revenue Velocity</Typography>
                <Typography variant="body2" color="text.secondary" fontSize={12}>Hourly breakdown showing high lunch & dinner order peaks</Typography>
              </Box>
              <Chip size="small" label="Weekly Sync" sx={{ bgcolor: '#F4ECE8', fontSize: 10 }} />
            </Box>
            <Box sx={{ height: 176, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 1, pt: 3 }}>
              {BARS.map(([d, h], i) => (
                <Box key={d} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, height: '100%', justifyContent: 'flex-end' }}>
                  <Box
                    sx={{
                      width: '100%',
                      height: `${h}%`,
                      borderRadius: '6px 6px 0 0',
                      bgcolor: i >= 4 ? '#C2410C' : '#FFDBD0',
                      ...(i === 5 && { bgcolor: '#9B2F00', boxShadow: 2 }),
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" fontWeight={i >= 4 ? 800 : 400} sx={{ fontSize: 10 }}>
                    {d}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <Box sx={{ bgcolor: '#fff', p: { xs: 2, sm: 2.5 }, borderRadius: 2, boxShadow: 1 }}>
            <Typography variant="subtitle1" fontWeight={700} fontSize={18} sx={{ mb: 2 }}>
              Top Performing Items
            </Typography>
            <Box sx={{ display: 'grid', gap: 2 }}>
              {DISHES.map((dish) => (
                <Box key={dish.name}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 14, height: 14, borderRadius: 1, border: `1.5px solid ${dish.veg}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: dish.veg }} />
                      </Box>
                      <Typography variant="body2" fontWeight={600} fontSize={12}>{dish.name}</Typography>
                    </Box>
                    <Typography variant="caption" fontWeight={800} sx={{ color: '#9B2F00', fontSize: 10 }}>
                      {dish.orders}
                    </Typography>
                  </Box>
                  <Box sx={{ height: 8, borderRadius: 999, bgcolor: '#F4ECE8' }}>
                    <Box sx={{ height: '100%', width: `${dish.pct}%`, borderRadius: 999, bgcolor: '#C2410C' }} />
                  </Box>
                </Box>
              ))}
            </Box>
            <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: '#FAF2EE', display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary" fontSize={12}>Live Stock 86 Toggle:</Typography>
              <Typography variant="caption" fontWeight={800} sx={{ color: '#00632B' }}>14 Active Modifiers</Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{ bgcolor: '#fff', p: { xs: 2, sm: 2.5 }, borderRadius: 2, boxShadow: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700} fontSize={18}>Live Floor Matrix</Typography>
              <Typography variant="body2" color="text.secondary" fontSize={12}>Floor 1 & Rooftop Patio Live Session Feed</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, fontSize: 10, fontWeight: 600, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#006A63' }} />Occupied (12)</Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#C2410C' }} />Billed (4)</Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#117E3B' }} />Ordering (2)</Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#BA1A1A' }} />KDS Warning (1)</Box>
            </Box>
          </Box>
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)', lg: 'repeat(8, 1fr)' } }}>
            {FLOOR.map((f) => (
              <Box
                key={f.t}
                sx={{
                  p: 1.5,
                  borderRadius: 3,
                  bgcolor: f.warn ? 'rgba(186,26,26,0.08)' : '#FAF2EE',
                  height: 80,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" fontWeight={800} fontSize={12} sx={{ color: f.bold ? '#9B2F00' : 'inherit' }}>
                    {f.t}
                  </Typography>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: f.dot }} />
                </Box>
                <Typography variant="body2" fontWeight={800} fontSize={12} sx={{ color: f.bold ? '#9B2F00' : '#006A63' }}>
                  {f.amt}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontSize={10}>
                  {f.sub}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Card>
  );
}
