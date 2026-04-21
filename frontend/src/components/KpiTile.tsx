import { Stack, Typography } from '@mui/material';
import { SurfacePanel } from './SurfacePanel';

type KpiTileProps = {
  label: string;
  value: string | number;
  meta?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
};

export function KpiTile({ label, value, meta, tone = 'default' }: KpiTileProps) {
  const colorMap = {
    default: 'text.secondary',
    success: 'success.main',
    warning: 'warning.main',
    danger: 'error.main',
  } as const;

  return (
    <SurfacePanel sx={{ p: 2 }}>
      <Stack spacing={1}>
        <Typography variant="subtitle2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h3">{value}</Typography>
        {meta ? (
          <Typography variant="body2" sx={{ color: colorMap[tone] }}>
            {meta}
          </Typography>
        ) : null}
      </Stack>
    </SurfacePanel>
  );
}
