import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';

type EmptyStateProps = {
  title: string;
  message?: string;
  icon?: ReactNode;
};

export default function EmptyState({ title, message, icon }: EmptyStateProps) {
  return (
    <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
      {icon ? <Box sx={{ mb: 1 }}>{icon}</Box> : null}
      <Typography variant="subtitle1" fontWeight={700}>
        {title}
      </Typography>
      {message ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          {message}
        </Typography>
      ) : null}
    </Box>
  );
}
