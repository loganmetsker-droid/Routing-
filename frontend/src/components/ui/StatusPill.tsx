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
        borderRadius: compact ? '3px' : '4px',
        fontSize: compact ? 11 : 12,
        fontWeight: 600,
        letterSpacing: '0.01em',
        lineHeight: 1.25,
        textTransform: 'none',
        color,
        bgcolor: alpha(color, 0.07),
        border: `1px solid ${alpha(color, 0.24)}`,
        borderLeft: `3px solid ${alpha(color, 0.8)}`,
        whiteSpace: 'normal',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        maxWidth: '100%',
        flexShrink: 1,
        minWidth: 0,
      }}
    >
      {label}
    </Box>
  );
}
