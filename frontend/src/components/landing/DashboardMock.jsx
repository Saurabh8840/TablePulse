import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { Avatar, Box, Card, Chip, LinearProgress, Typography } from '@mui/material';

const STATS = [
  { label: "Today's revenue", value: '₹24,580', delta: '+18% vs yesterday', live: false },
  { label: 'Orders today', value: '47', delta: '+9 this hour', live: false },
  { label: 'Active tables', value: '8/15', delta: 'LIVE', live: true },
  { label: 'Avg. prep time', value: '12 min', delta: '-2 min this week', live: false },
];

const BARS = [
  ['M', 42], ['T', 55], ['W', 38], ['T', 62], ['F', 78], ['S', 100], ['S', 20],
];

const DISHES = [
  ['Singapore Noodles', 23, 100],
  ['Paneer Tikka', 18, 78],
  ['Masala Dosa', 15, 65],
  ['Iced Tea', 14, 60],
];

const ORDERS = [
  ['ORD-1047', 'T12', '₹498', 'Preparing', 'warning'],
  ['ORD-1046', 'T08', '₹850', 'Ready', 'success'],
  ['ORD-1045', 'T03', '₹340', 'Placed', 'info'],
];

const TABLES = [
  ['T01', 'empty'], ['T02', 'busy'], ['T03', 'ready'], ['T04', 'empty'],
  ['T05', 'busy'], ['T06', 'empty'], ['T07', 'busy'], ['T08', 'busy'],
];

const TABLE_COLOR = {
  empty: { bg: 'success.main', label: 'Empty' },
  busy: { bg: 'warning.main', label: 'Busy' },
  ready: { bg: 'error.main', label: 'Ready!' },
};

/**
 * Static-but-alive product mock: what an owner sees after setup.
 * Clearly a preview (caption below it says so) — built to make a
 * first-time visitor feel "ok, this is a dashboard" in 3 seconds.
 */
export default function DashboardMock() {
  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: { xs: 4, md: 6 },
        overflow: 'hidden',
        boxShadow: 6,
        border: 1,
        borderColor: 'divider',
      }}
    >
      {/* Browser chrome */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.25,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.default',
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          {['#f87171', '#fbbf24', '#34d399'].map((c) => (
            <Box key={c} sx={{ width: 11, height: 11, borderRadius: '50%', bgcolor: c }} />
          ))}
        </Box>
        <Box
          sx={{
            flexGrow: 1,
            textAlign: 'center',
            fontSize: 12,
            fontFamily: 'monospace',
            color: 'text.secondary',
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            py: 0.4,
            px: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          app.tablepulse.in/admin
        </Box>
        <Chip
          size="small"
          color="success"
          icon={<FiberManualRecordIcon sx={{ fontSize: '10px !important', animation: 'pulse 1.6s infinite' }} />}
          label="LIVE PREVIEW"
          sx={{ fontWeight: 800, '@keyframes pulse': { '50%': { opacity: 0.35 } } }}
        />
      </Box>

      <Box sx={{ p: { xs: 2, md: 3 }, display: 'grid', gap: 2 }}>
        {/* Stat tiles */}
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr 1fr', xl: 'repeat(4, 1fr)' } }}>
          {STATS.map((s) => (
            <Box
              key={s.label}
              sx={{ p: 1.75, borderRadius: 3, border: 1, borderColor: 'divider', bgcolor: 'background.default' }}
            >
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
                {s.label}
              </Typography>
              <Typography variant="h5" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums', my: 0.25 }}>
                {s.value}
              </Typography>
              <Typography variant="caption" fontWeight={700} color={s.live ? 'error.main' : 'success.main'}>
                {s.delta}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1.2fr 1fr 1fr' } }}>
          {/* Revenue chart */}
          <Box sx={{ p: 2, borderRadius: 3, border: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
            <Typography variant="subtitle2" fontWeight={800} gutterBottom>
              Revenue this week
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 110, pt: 1 }}>
              {BARS.map(([d, h], i) => (
                <Box key={i} sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, height: '100%', justifyContent: 'flex-end' }}>
                  <Box
                    sx={{
                      width: '100%',
                      maxWidth: 34,
                      height: `${h}%`,
                      borderRadius: 1.5,
                      backgroundImage:
                        i === 5
                          ? 'linear-gradient(180deg, #ea580c, #9a3412)'
                          : 'linear-gradient(180deg, rgba(234,88,12,.45), rgba(234,88,12,.15))',
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {d}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Top dishes */}
          <Box sx={{ p: 2, borderRadius: 3, border: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
            <Typography variant="subtitle2" fontWeight={800} gutterBottom>
              🏆 Top dishes today
            </Typography>
            <Box sx={{ display: 'grid', gap: 1.25, mt: 1 }}>
              {DISHES.map(([name, count, pct]) => (
                <Box key={name}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {count}
                    </Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={pct} sx={{ height: 6, borderRadius: 3 }} />
                </Box>
              ))}
            </Box>
          </Box>

          {/* Live orders */}
          <Box sx={{ p: 2, borderRadius: 3, border: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
            <Typography variant="subtitle2" fontWeight={800} gutterBottom>
              ⚡ Live orders
            </Typography>
            <Box sx={{ display: 'grid', gap: 1, mt: 1 }}>
              {ORDERS.map(([id, table, amt, status, color]) => (
                <Box
                  key={id}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}
                >
                  <Avatar sx={{ width: 30, height: 30, fontSize: 12, fontWeight: 800, bgcolor: 'primary.main' }}>
                    {table}
                  </Avatar>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {amt}
                    </Typography>
                  </Box>
                  <Chip label={status} size="small" color={color} />
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        {/* Table floor */}
        <Box sx={{ p: 2, borderRadius: 3, border: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
          <Typography variant="subtitle2" fontWeight={800} gutterBottom>
            Floor right now — Koramangala branch
          </Typography>
          <Box sx={{ display: 'grid', gap: 1, mt: 1, gridTemplateColumns: { xs: 'repeat(4, 1fr)', md: 'repeat(8, 1fr)' } }}>
            {TABLES.map(([t, s]) => (
              <Box
                key={t}
                sx={{
                  textAlign: 'center',
                  py: 1,
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.4 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: TABLE_COLOR[s].bg }} />
                </Box>
                <Typography variant="body2" fontWeight={800}>
                  {t}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {TABLE_COLOR[s].label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Card>
  );
}
