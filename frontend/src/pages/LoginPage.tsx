import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  CircularProgress,
  Typography,
  Alert,
  Stack,
  TextField,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import StatusPill from '../components/ui/StatusPill';
import { moduleAccents } from '../theme/tokens';
import { TopoShellBackground } from '../components/TopoShellBackground';
import { trovanBrandAssets, trovanColors } from '../theme/designTokens';
import {
  beginWorkosLogin,
  isAuthBypassed,
  isDriverOnlyAuthUser,
  login,
  useAuthConfigQuery,
} from '../services/api.session';

const supportHref = 'mailto:support@trytrovan.com?subject=Trovan%20access%20or%20login%20help';

function getFriendlyLoginError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/timed out|backend|network|failed to fetch|unavailable/i.test(message)) {
    return 'We could not reach Trovan sign-in. Retry in a moment or request access/support.';
  }
  return message || 'Login failed. Check your credentials or request access/support.';
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const authBypassed = isAuthBypassed();
  const authConfigQuery = useAuthConfigQuery();
  const authConfig = authConfigQuery.data;
  const providerReady =
    authConfig?.preferredProvider === 'workos' &&
    authConfig.enabled &&
    authConfig.workos.clientIdConfigured;
  const backendUnavailable = !authBypassed && authConfigQuery.isError;
  const checkingSignIn = authConfigQuery.isLoading || authConfigQuery.isFetching;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      setLoading(true);
      const session = await login(email, password);
      navigate(isDriverOnlyAuthUser(session.user) ? '/driver' : '/dashboard');
    } catch (err: unknown) {
      setError(getFriendlyLoginError(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewLogin = async () => {
    setError('');
    try {
      setLoading(true);
      await login('driver-demo@trovan.local', 'preview');
      navigate('/driver');
    } catch (err: unknown) {
      setError(getFriendlyLoginError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleWorkosLogin = async () => {
    setError('');
    try {
      setLoading(true);
      await beginWorkosLogin();
    } catch (err: unknown) {
      setError(getFriendlyLoginError(err));
      setLoading(false);
    }
  };

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
        background:
          `radial-gradient(circle at 24% 12%, ${alpha(trovanColors.copper[500], 0.16)}, transparent 28%), linear-gradient(145deg, ${trovanColors.brand.navy950} 0%, ${trovanColors.brand.navy850} 48%, ${trovanColors.brand.navy950} 100%)`,
      }}
    >
      <TopoShellBackground active tone="black" />
      <Card
        sx={{
          maxWidth: 440,
          width: '100%',
          borderRadius: 2,
          position: 'relative',
          zIndex: 1,
          bgcolor: alpha(trovanColors.utility.panel, 0.96),
          borderColor: alpha(trovanColors.copper[500], 0.2),
          color: '#FFF8ED',
        }}
      >
        <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
          <Box
            component="img"
            src={trovanBrandAssets.primaryLockupCrop}
            alt="Trovan Dispatch"
            sx={{ width: 320, maxWidth: '84%', height: 'auto', display: 'block', mb: 2.2 }}
          />
          <Typography variant="h4" sx={{ mt: 0.75 }}>
            Welcome back
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: 1.5 }}>
            Secure access to dispatch, tracking, and route operations.
          </Typography>
          <Stack direction="row" spacing={0.8} sx={{ mb: 2 }}>
            <StatusPill compact label="Dispatch" color={moduleAccents.dispatch} />
            <StatusPill compact label="Tracking" color={moduleAccents.tracking} />
            <StatusPill compact label="Jobs" color={moduleAccents.jobs} />
          </Stack>

          <Divider sx={{ mb: 2 }} />

          {authBypassed && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Preview mode is enabled. Sign-in is bypassed locally while the backend is unavailable.
            </Alert>
          )}

          {checkingSignIn ? (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }} data-testid="login-loading">
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                Checking sign-in availability...
              </Typography>
            </Stack>
          ) : null}

          {backendUnavailable ? (
            <Alert severity="warning" sx={{ mb: 2 }} data-testid="login-unavailable">
              <Typography sx={{ fontWeight: 800, mb: 0.5 }}>
                Sign-in is temporarily unavailable.
              </Typography>
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                Trovan could not reach the authentication service. Your route workspace is safe; try again or request access/support.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => void authConfigQuery.refetch()}
                  disabled={authConfigQuery.isFetching}
                >
                  {authConfigQuery.isFetching ? 'Checking...' : 'Retry'}
                </Button>
                <Button component="a" href={supportHref} variant="outlined" size="small">
                  Request access/support
                </Button>
              </Stack>
            </Alert>
          ) : null}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {providerReady && !backendUnavailable ? (
            <Button
              variant="contained"
              fullWidth
              size="large"
              sx={{
                mb: authConfig?.localLoginAllowed ? 2 : 0,
              }}
              disabled={loading}
              onClick={handleWorkosLogin}
            >
              {loading ? 'Redirecting...' : 'Continue with WorkOS'}
            </Button>
          ) : null}

          {authConfig?.workos.mfaManagedByProvider && !backendUnavailable ? (
            <Alert severity="success" sx={{ mb: authConfig?.localLoginAllowed ? 2 : 0 }}>
              MFA and SSO policy are handled by WorkOS when provider sign-in is enabled.
            </Alert>
          ) : null}

          {authBypassed ? (
            <Button
              variant="contained"
              fullWidth
              size="large"
              sx={{ mt: 1 }}
              disabled={loading}
              onClick={handlePreviewLogin}
              data-testid="login-demo"
            >
              {loading ? 'Opening demo...' : 'Open Driver Demo'}
            </Button>
          ) : null}

          {!backendUnavailable && !authBypassed && (authConfig?.localLoginAllowed || !providerReady) ? (
            <form onSubmit={handleSubmit} data-testid="login-form">
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                margin="normal"
                required
                inputProps={{ 'data-testid': 'login-email' }}
              />
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
                required
                inputProps={{ 'data-testid': 'login-password' }}
              />
              <Button
                type="submit"
                variant="outlined"
                fullWidth
                size="large"
                sx={{
                  mt: 3,
                }}
                disabled={loading}
                data-testid="login-submit"
              >
                {loading
                  ? 'Logging in...'
                  : providerReady
                      ? 'Use Local Admin Login'
                      : 'Sign In'}
              </Button>
            </form>
          ) : null}
          {!authBypassed && !backendUnavailable ? (
            <Button component="a" href={supportHref} variant="text" fullWidth sx={{ mt: 1.5 }}>
              Request access/support
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </Box>
  );
}
