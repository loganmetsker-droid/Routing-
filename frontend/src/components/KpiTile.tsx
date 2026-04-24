import { Stack, Typography } from '@mui/material';
import { trovanColors } from '../theme/designTokens';
import { SurfacePanel } from './SurfacePanel';

type KpiTileProps = {
  label: string;
  value: string | number;
  meta?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
};

export function KpiTile({ label, value, meta, tone = 'default' }: KpiTileProps) {
  const colorMap = {
    default: trovanColors.stone[600],
    success: trovanColors.semantic.success,
    warning: trovanColors.semantic.warning,
    danger: trovanColors.semantic.danger,
  } as const;

  return (
    <SurfacePanel variant="muted" padding={1.5} sx={{ minHeight: 96 }}>
      <Stack spacing={0.45}>
        <Typography
          variant="subtitle2"
          color="text.secondary"
          sx={{ letterSpacing: '0.1em', fontSize: '0.72rem' }}
        >
          {label}
        </Typography>
        <Typography
          variant="h4"
          sx={{
            lineHeight: 1,
            overflowWrap: 'normal',
            fontWeight: 700,
          }}
        >
          {value}
        </Typography>
        {meta ? (
          <Typography
            variant="caption"
            sx={{ color: colorMap[tone], maxWidth: '100%', lineHeight: 1.35 }}
          >
            {meta}
          </Typography>
        ) : null}
      </Stack>
    </SurfacePanel>
  );
}
