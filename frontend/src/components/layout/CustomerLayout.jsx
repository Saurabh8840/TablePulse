import { Box, Typography } from '@mui/material';

/** Phone-first container for customer screens (menu/cart/track/bill).
 *  `wide` gives the menu a Zomato-style content width on tablet/desktop,
 *  while cart/track/bill stay narrow and readable. */
export default function CustomerLayout({ title, subtitle, children, wide = false }) {
  return (
    <Box
      sx={{
        minHeight: '100svh',
        bgcolor: 'background.default',
        pb: { xs: 12, sm: 8 },
      }}
    >
      <Box
        sx={{
          maxWidth: wide ? 1080 : 560,
          mx: 'auto',
          width: '100%',
          px: { xs: 1.5, sm: 2, md: wide ? 3 : 2 },
        }}
      >
        {(title || subtitle) && !wide && (
          <Box sx={{ mb: 2, pt: 1.5, textAlign: 'center' }}>
            {title && (
              <Typography variant="h5" component="h1" gutterBottom>
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
        )}
        {children}
      </Box>
    </Box>
  );
}
