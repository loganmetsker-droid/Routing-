import { type ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import type { SystemStyleObject } from '@mui/system';
import { SurfacePanel } from '../SurfacePanel';
import { trovanColors } from '../../theme/designTokens';

type OpsStyle = SystemStyleObject<Theme>;

type OpsCommandBarProps = {
  eyebrow?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  sx?: OpsStyle;
};

export function OpsCommandBar({
  eyebrow,
  title,
  subtitle,
  filters,
  actions,
  meta,
  sx,
}: OpsCommandBarProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <SurfacePanel
      variant="command"
      padding={1.5}
      sx={{
        display: 'grid',
        gap: 1.25,
        background:
          isDark
            ? `linear-gradient(135deg, ${alpha(trovanColors.utility.panel, 0.96)}, ${alpha(trovanColors.copper[900], 0.24)})`
            : `linear-gradient(135deg, ${alpha('#F8F7F3', 0.94)}, ${alpha(trovanColors.copper[100], 0.28)})`,
        borderColor: isDark ? trovanColors.utility.borderStrong : alpha(trovanColors.black[900], 0.14),
        ...sx,
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.25}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
      >
        <Box sx={{ minWidth: 0 }}>
          {eyebrow ? (
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.4 }}>
              {eyebrow}
            </Typography>
          ) : null}
          {title ? (
            <Typography
              variant="h5"
              component="div"
              sx={{ color: 'text.primary', letterSpacing: '-0.018em' }}
            >
              {title}
            </Typography>
          ) : null}
          {subtitle ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {actions ? (
          <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
            {actions}
          </Stack>
        ) : null}
      </Stack>
      {(filters || meta) ? (
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={0.85}
          alignItems={{ xs: 'stretch', lg: 'center' }}
          justifyContent="space-between"
        >
          {filters ? (
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {filters}
            </Stack>
          ) : null}
          {meta ? (
            <Box sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
              {meta}
            </Box>
          ) : null}
        </Stack>
      ) : null}
    </SurfacePanel>
  );
}

export default OpsCommandBar;
