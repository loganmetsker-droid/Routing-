import { Box, Typography, type SxProps, type Theme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { trovanColors } from '../theme/designTokens';

export type StatusPillTone =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'accent';

type StatusPillProps = {
  label: string;
  tone?: StatusPillTone;
  sx?: SxProps<Theme>;
};

const toneStyles: Record<StatusPillTone, { color: string; border: string; background: string }> = {
  default: {
    color: trovanColors.stone[600],
    border: alpha(trovanColors.stone[500], 0.12),
    background: trovanColors.utility.panelMuted,
  },
  success: {
    color: trovanColors.semantic.success,
    border: alpha(trovanColors.semantic.success, 0.16),
    background: alpha(trovanColors.semantic.success, 0.07),
  },
  warning: {
    color: trovanColors.semantic.warning,
    border: alpha(trovanColors.semantic.warning, 0.16),
    background: alpha(trovanColors.semantic.warning, 0.07),
  },
  danger: {
    color: trovanColors.semantic.danger,
    border: alpha(trovanColors.semantic.danger, 0.15),
    background: alpha(trovanColors.semantic.danger, 0.07),
  },
  info: {
    color: trovanColors.semantic.info,
    border: alpha(trovanColors.semantic.info, 0.15),
    background: alpha(trovanColors.semantic.info, 0.07),
  },
  accent: {
    color: trovanColors.copper[600],
    border: alpha(trovanColors.copper[500], 0.16),
    background: alpha(trovanColors.copper[500], 0.07),
  },
};

export function StatusPill({
  label,
  tone = 'default',
  sx,
}: StatusPillProps) {
  const style = toneStyles[tone];
  return (
    <Box
      sx={[
        {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          minHeight: 21,
          px: 0.8,
          borderRadius: 1,
          border: '1px solid',
          borderColor: style.border,
          bgcolor: style.background,
          maxWidth: '100%',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Typography
        variant="caption"
        sx={{
          color: style.color,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontSize: '0.66rem',
          fontFamily: 'inherit',
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

export default StatusPill;
