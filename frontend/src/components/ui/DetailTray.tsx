import { alpha } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { shellTokens } from '../../theme/tokens';

type DetailTrayProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  height?: number | string;
  sx?: SxProps<Theme>;
};

export default function DetailTray({ title, subtitle, action, children, height, sx }: DetailTrayProps) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: `${shellTokens.radius.md}px`,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: (theme) => alpha(theme.palette.background.paper, 0.97),
        boxShadow: shellTokens.shadow.soft,
        height: height || 'auto',
        display: 'flex',
        flexDirection: 'column',
        ...sx,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5, gap: 1.25, minWidth: 0 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.25 }}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {action}
      </Box>
      <Box
        sx={{
          mt: 0.5,
          minHeight: 0,
          flex: 1,
          overflow: height ? 'auto' : 'visible',
          pr: height ? 0.25 : 0,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
