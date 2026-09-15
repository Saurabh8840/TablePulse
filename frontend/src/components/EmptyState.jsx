import { Box, Button, Typography } from '@mui/material';

/** Friendly empty state with icon, title, body and optional CTA. */
export default function EmptyState({ icon, title, body, actionLabel, onAction, to }) {
  return (
    <Box
      sx={{
        textAlign: 'center',
        py: { xs: 5, md: 7 },
        px: 3,
        border: '1.5px dashed',
        borderColor: 'divider',
        borderRadius: 5,
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ fontSize: 44, lineHeight: 1, mb: 1.5 }}>{icon}</Box>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      {body && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, mx: 'auto', mb: 2.5 }}>
          {body}
        </Typography>
      )}
      {actionLabel && (
        <Button variant="contained" onClick={onAction} {...(to ? { href: to } : {})}>
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}
