import { Box, Typography, type SxProps, type Theme } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
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

export function StatusPill({
  label,
  tone = 'default',
  sx,
}: StatusPillProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const baseText = isDark ? '#FFF8ED' : '#17110D';
  const toneStyles: Record<StatusPillTone, { color: string; border: string; background: string }> = {
    default: {
      color: alpha(baseText, 0.78),
      border: alpha(baseText, isDark ? 0.14 : 0.16),
      background: alpha(baseText, isDark ? 0.045 : 0.055),
    },
    success: {
      color: isDark ? '#9BC38F' : '#315F3B',
      border: alpha(trovanColors.semantic.success, isDark ? 0.18 : 0.26),
      background: alpha(trovanColors.semantic.success, isDark ? 0.065 : 0.095),
    },
    warning: {
      color: isDark ? '#E2B36D' : '#7A4F18',
      border: alpha(trovanColors.semantic.warning, isDark ? 0.18 : 0.26),
      background: alpha(trovanColors.semantic.warning, isDark ? 0.065 : 0.1),
    },
    danger: {
      color: isDark ? '#D98978' : '#814039',
      border: alpha(trovanColors.semantic.danger, isDark ? 0.18 : 0.26),
      background: alpha(trovanColors.semantic.danger, isDark ? 0.065 : 0.095),
    },
    info: {
      color: isDark ? '#9FB1D8' : '#445E83',
      border: alpha(trovanColors.semantic.info, isDark ? 0.18 : 0.25),
      background: alpha(trovanColors.semantic.info, isDark ? 0.065 : 0.09),
    },
    accent: {
      color: isDark ? trovanColors.copper[300] : trovanColors.copper[700],
      border: alpha(trovanColors.copper[500], isDark ? 0.22 : 0.28),
      background: alpha(trovanColors.copper[500], isDark ? 0.075 : 0.1),
    },
  };
  const style = toneStyles[tone];
  return (
    <Box
      sx={[
        {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          minHeight: 20,
          px: 0.75,
          borderRadius: '5px',
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
          fontWeight: 750,
          lineHeight: 1,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontSize: '0.64rem',
          fontFamily: 'inherit',
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

export default StatusPill;
