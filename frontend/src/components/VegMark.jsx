import { Box } from '@mui/material';

/** Authentic Indian veg / non-veg mark (square + circle), like Zomato/Swiggy.
 *  `veg` true -> green, false -> red/brown. */
export default function VegMark({ veg, size = 16 }) {
  const color = veg ? '#15803d' : '#b91c1c';
  return (
    <Box
      aria-label={veg ? 'veg' : 'non-veg'}
      sx={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: '4px',
        border: `2px solid ${color}`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#fff',
      }}
    >
      {veg ? (
        <Box sx={{ width: size * 0.45, height: size * 0.45, borderRadius: '50%', bgcolor: color }} />
      ) : (
        <Box
          sx={{
            width: 0,
            height: 0,
            borderLeft: `${size * 0.28}px solid transparent`,
            borderRight: `${size * 0.28}px solid transparent`,
            borderBottom: `${size * 0.45}px solid ${color}`,
          }}
        />
      )}
    </Box>
  );
}
