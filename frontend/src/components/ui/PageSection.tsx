import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { shellTokens } from '../../theme/tokens';

type PageSectionProps = {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
};

export default function PageSection({ title, subtitle, action, children }: PageSectionProps) {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: `${shellTokens.radius.md}px`,
        bgcolor: (theme) => alpha(theme.palette.background.paper, 0.96),
        p: 2,
      }}
    >
      {title ? (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.25, mb: 1.5 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {title}
            </Typography>
            {subtitle ? (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          {action}
        </Box>
      ) : null}
      {children}
    </Box>
  );
}
