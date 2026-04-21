import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      alignItems={{ xs: 'flex-start', md: 'center' }}
      justifyContent="space-between"
      spacing={2}
      sx={{ mb: 3 }}
    >
      <Box>
        {eyebrow ? (
          <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 0.5 }}>
            {eyebrow}
          </Typography>
        ) : null}
        <Typography variant="h2" sx={{ mb: subtitle ? 0.75 : 0 }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body1" color="text.secondary">
            {subtitle}
          </Typography>
        ) : null}
      </Box>

      {actions ? <Stack direction="row" spacing={1.25} flexWrap="wrap">{actions}</Stack> : null}
    </Stack>
  );
}
