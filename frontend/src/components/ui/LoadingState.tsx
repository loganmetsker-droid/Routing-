import { Box, CircularProgress, Typography } from '@mui/material';

type LoadingStateProps = {
  label?: string;
  minHeight?: number | string;
};

export default function LoadingState({ label = 'Loading...', minHeight = '40vh' }: LoadingStateProps) {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight }}>
      <Box sx={{ textAlign: 'center' }}>
        <CircularProgress size={30} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
          {label}
        </Typography>
      </Box>
    </Box>
  );
}
