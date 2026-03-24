import type { ReactNode } from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';
import StatusPill from './StatusPill';

type InfoCardProps = {
  title: string;
  value: number;
  total?: number;
  subtitle?: string;
  icon?: ReactNode;
  statusLabel?: string;
  statusColor?: string;
};

export default function InfoCard({
  title,
  value,
  total,
  subtitle,
  icon,
  statusLabel,
  statusColor = '#64748b',
}: InfoCardProps) {
  return (
    <Card
      sx={{
        height: '100%',
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: 'none',
      }}
    >
      <CardContent sx={{ p: 2.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            {title}
          </Typography>
          {icon ? <Box sx={{ color: 'text.secondary' }}>{icon}</Box> : null}
        </Box>
        <Typography variant="h4" sx={{ lineHeight: 1.1 }} fontWeight={700}>
          {value}
          {typeof total === 'number' && total !== value ? (
            <Typography component="span" variant="h6" color="text.secondary" sx={{ ml: 0.75 }}>
              / {total}
            </Typography>
          ) : null}
        </Typography>
        <Box sx={{ mt: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
          {statusLabel ? <StatusPill label={statusLabel} color={statusColor} /> : null}
        </Box>
      </CardContent>
    </Card>
  );
}
