import { Box, Chip, Stack, Typography } from '@mui/material';
import { SurfacePanel } from './SurfacePanel';

export function PreviewBanner() {
  const showPreviewBanner =
    import.meta.env.DEV ||
    import.meta.env.VITE_MOCK_PREVIEW === 'true' ||
    import.meta.env.VITE_AUTH_BYPASS === 'true';

  if (!showPreviewBanner) {
    return null;
  }

  return (
    <SurfacePanel
      sx={{
        mb: 2,
        p: 1.75,
        bgcolor: 'rgba(250, 241, 234, 0.85)',
        borderColor: 'rgba(216, 162, 127, 0.45)',
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between">
        <Box>
          <Typography variant="h6">Routing Dispatch Preview</Typography>
          <Typography variant="body2" color="text.secondary">
            Frontend: {typeof window !== 'undefined' ? window.location.origin : 'local'} • API:{' '}
            {import.meta.env.VITE_REST_API_URL || 'mock'}
          </Typography>
        </Box>
        <Chip label="Preview only" color="primary" />
      </Stack>
    </SurfacePanel>
  );
}
