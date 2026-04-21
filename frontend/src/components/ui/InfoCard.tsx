import type { ReactNode } from 'react';
import { alpha } from '@mui/material/styles';
import { Box, Card, CardContent, Typography } from '@mui/material';
import StatusPill from './StatusPill';
import { shellTokens } from '../../theme/tokens';

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
        borderRadius: `${shellTokens.radius.md}px`,
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: shellTokens.shadow.soft,
        bgcolor: (theme) => alpha(theme.palette.background.paper, 0.96),
      }}
    >
      <CardContent sx={{ p: 2.4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25, gap: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: 0 }}>
            {title}
          </Typography>
          {icon ? <Box sx={{ color: 'text.secondary', opacity: 0.8 }}>{icon}</Box> : null}
        </Box>
        <Typography variant="h4" sx={{ lineHeight: 1.1 }} fontWeight={700}>
          {value}
          {typeof total === 'number' && total !== value ? (
            <Typography component="span" variant="h6" color="text.secondary" sx={{ ml: 0.75 }}>
              / {total}
            </Typography>
          ) : null}
        </Typography>
        <Box sx={{ mt: 1.4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 0 }}>
            {subtitle}
          </Typography>
          {statusLabel ? <StatusPill label={statusLabel} color={statusColor} /> : null}
        </Box>
      </CardContent>
    </Card>
  );
}
