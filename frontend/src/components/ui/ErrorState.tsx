import { Box, Button, Typography } from '@mui/material';

type ErrorStateProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
};

export default function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
      <Typography color="error.main" sx={{ fontSize: 26, mb: 1, fontWeight: 800, letterSpacing: '0.08em' }}>
        ERROR
      </Typography>
      <Typography variant="subtitle1" fontWeight={700}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
        {message}
      </Typography>
      {onRetry ? (
        <Button variant="outlined" size="small" sx={{ mt: 2 }} onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </Box>
  );
}
