import { alpha } from '@mui/material/styles';
import { Box } from '@mui/material';

type StatusPillProps = {
  label: string;
  color: string;
};

export default function StatusPill({ label, color }: StatusPillProps) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1.25,
        py: 0.5,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.04em',
        color,
        bgcolor: alpha(color, 0.12),
        border: `1px solid ${alpha(color, 0.22)}`,
      }}
    >
      {label}
    </Box>
  );
}
