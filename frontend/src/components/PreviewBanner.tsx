import { Box, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  getTrovanDataMode,
  getTrovanDataModeCopy,
  type TrovanDataMode,
} from '../services/dataMode';
import { trovanColors } from '../theme/designTokens';

export function shouldShowDataModeBanner(mode: TrovanDataMode) {
  return import.meta.env.DEV || mode !== 'live';
}

export function PreviewBanner() {
  const mode = getTrovanDataMode();
  const showPreviewBanner = shouldShowDataModeBanner(mode);
  const copy = getTrovanDataModeCopy(mode);

  if (!showPreviewBanner) {
    return null;
  }

  return (
    <Stack
      direction="row"
      spacing={0.7}
      alignItems="center"
      sx={{
        px: 1.05,
        py: 0.45,
        borderRadius: 999,
        bgcolor: alpha(trovanColors.copper[500], 0.1),
        border: `1px solid ${alpha(trovanColors.copper[500], 0.24)}`,
        width: 'fit-content',
        maxWidth: '100%',
        minWidth: 0,
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
      <Typography variant="caption" sx={{ fontWeight: 800, fontSize: 11.5, lineHeight: 1, whiteSpace: 'nowrap' }}>
        {copy.label}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          lineHeight: 1,
          fontSize: 11.5,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {copy.detail}
      </Typography>
    </Stack>
  );
}
