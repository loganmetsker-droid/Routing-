import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Box, Card, CardContent, CircularProgress, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { TopoShellBackground } from '../components/TopoShellBackground';
import { completeWorkosCallback } from '../services/api.session';
import { trovanColors } from '../theme/designTokens';

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const code = searchParams.get('code');
    const invitationToken =
      searchParams.get('invitation_token') ||
      searchParams.get('invitationToken') ||
      undefined;

    const run = async () => {
      if (!code) {
        setError('Missing WorkOS authorization code.');
        return;
      }

      try {
        await completeWorkosCallback(code, invitationToken);
        if (!cancelled) {
          navigate('/', { replace: true });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to complete WorkOS sign-in.',
          );
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate, searchParams]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        p: 2.5,
        position: 'relative',
        overflow: 'hidden',
        bgcolor: trovanColors.black[950],
      }}
    >
      <TopoShellBackground active tone="black" />
      <Card sx={{ maxWidth: 440, width: '100%', borderRadius: 2, position: 'relative', zIndex: 1, bgcolor: alpha(trovanColors.utility.panel, 0.96), color: '#FFF8ED' }}>
        <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
          <Typography variant="h5">Completing secure sign-in</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Trovan is finishing your WorkOS session and restoring your organization context.
          </Typography>

          {error ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          ) : (
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mt: 2 }}>
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                Validating callback and starting your operator session...
              </Typography>
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
