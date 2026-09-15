import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { IconButton, Tooltip } from '@mui/material';
import { useColorMode } from '../hooks/useColorMode.js';

export default function ModeToggle() {
  const { mode, toggleMode } = useColorMode();
  const isDark = mode === 'dark';
  const next = isDark ? 'light' : 'dark';
  return (
    <Tooltip title={`Switch to ${next} mode`}>
      <IconButton aria-label={`switch to ${next} mode`} onClick={toggleMode} color="inherit" size="large">
        {isDark ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
    </Tooltip>
  );
}
