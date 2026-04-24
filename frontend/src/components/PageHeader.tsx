import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { trovanColors } from '../theme/designTokens';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', xl: 'row' }}
      alignItems={{ xs: 'flex-start', xl: 'flex-start' }}
      justifyContent="space-between"
      spacing={1.5}
      sx={{ mb: 2 }}
    >
      <Box sx={{ minWidth: 0, flex: 1, maxWidth: 1120 }}>
        {eyebrow ? (
          <Typography
            variant="subtitle2"
            component="div"
            sx={{
              color: trovanColors.copper[500],
              mb: 0.35,
              fontWeight: 800,
              letterSpacing: '0.14em',
            }}
          >
            {eyebrow}
          </Typography>
        ) : null}
        <Typography
          variant="h2"
          component="h1"
          sx={{
            mb: subtitle ? 0.45 : 0,
            maxWidth: 'none',
            overflowWrap: 'normal',
            whiteSpace: 'normal',
          }}
        >
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body1" component="p" color="text.secondary" sx={{ maxWidth: 980 }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>

      {actions ? (
        <Stack
          direction="row"
          spacing={1.25}
          flexWrap="wrap"
          sx={{
            justifyContent: { xs: 'flex-start', xl: 'flex-end' },
            width: { xs: '100%', xl: 'auto' },
            '& > *': {
              flexShrink: 0,
            },
          }}
        >
          {actions}
        </Stack>
      ) : null}
    </Stack>
  );
}
