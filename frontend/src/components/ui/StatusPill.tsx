import { alpha } from '@mui/material/styles';
import { Box } from '@mui/material';

type StatusPillProps = {
  label: string;
  color: string;
  compact?: boolean;
};

export default function StatusPill({ label, color, compact = false }: StatusPillProps) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: compact ? 0.85 : 1.2,
        py: compact ? 0.42 : 0.58,
        borderRadius: compact ? '5px' : '6px',
        fontSize: compact ? 11 : 12,
        fontWeight: 750,
        letterSpacing: '0.025em',
        lineHeight: 1.25,
        textTransform: 'uppercase',
        color,
        bgcolor: alpha(color, 0.1),
        border: `1px solid ${alpha(color, 0.32)}`,
        boxShadow: `inset 0 0 0 1px ${alpha('#FFF8ED', 0.035)}`,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '100%',
        flexShrink: 1,
        minWidth: 0,
      }}
    >
      {label}
    </Box>
  );
}
