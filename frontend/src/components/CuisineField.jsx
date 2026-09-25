import { Box, MenuItem, TextField } from '@mui/material';
import { CUISINE_OPTIONS } from '../utils/restaurantMeta.js';

const OTHER = 'Other…';

/**
 * Cuisine select with free-text fallback. The stored value is always a plain
 * string: a listed option, or whatever was typed under Other. Values saved
 * before this component existed (or edited elsewhere) load back as
 * Other + prefilled text, so nothing is ever lost or blocked.
 */
export default function CuisineField({ value, onChange, required, size, disabled }) {
  const listed = CUISINE_OPTIONS.includes(value);
  const selectValue = !value ? '' : listed ? value : OTHER;

  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: selectValue === OTHER && value ? { xs: '1fr', sm: '1fr 1fr' } : '1fr' }}>
      <TextField
        label={required ? 'Cuisine *' : 'Cuisine'}
        select
        required={required}
        size={size}
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === OTHER ? (listed ? '' : value) : v);
        }}
        disabled={disabled}
      >
        {CUISINE_OPTIONS.map((c) => (
          <MenuItem key={c} value={c}>{c}</MenuItem>
        ))}
        <MenuItem value={OTHER}>{OTHER}</MenuItem>
      </TextField>
      {selectValue === OTHER && (
        <TextField
          label="What's your cuisine?"
          required={required}
          size={size}
          value={listed ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. Bihari, North Indian"
          inputProps={{ maxLength: 200 }}
          disabled={disabled}
        />
      )}
    </Box>
  );
}
