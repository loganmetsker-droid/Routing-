import { Box, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { trovanColors } from '../theme/designTokens';

export function PreviewBanner() {
  const showPreviewBanner =
    import.meta.env.DEV ||
    import.meta.env.VITE_MOCK_PREVIEW === 'true' ||
    import.meta.env.VITE_AUTH_BYPASS === 'true';

  if (!showPreviewBanner) {
    return null;
  }

  return (
    <Stack
      direction="row"
      spacing={0.7}
      alignItems="center"
      sx={{
        px: 0.85,
        py: 0.45,
        borderRadius: 1.1,
        bgcolor: alpha('#FFFDFB', 0.84),
        border: `1px solid ${alpha(trovanColors.copper[500], 0.11)}`,
        width: 'fit-content',
      }}
    >
      <Box
        sx={{
          width: 7,
          height: 7,
          borderRadius: '999px',
          bgcolor: trovanColors.copper[500],
          boxShadow: `0 0 0 3px ${alpha(trovanColors.copper[500], 0.12)}`,
          flexShrink: 0,
        }}
      />
      <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1 }}>
        Preview
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
        {import.meta.env.VITE_REST_API_URL || 'Mock API'}
      </Typography>
    </Stack>
  );
}
