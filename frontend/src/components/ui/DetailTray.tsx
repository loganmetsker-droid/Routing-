import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

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
        p: 2.25,
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        height: height || 'auto',
        overflow: height ? 'auto' : 'visible',
        ...sx,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>
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
      {children}
    </Box>
  );
}
