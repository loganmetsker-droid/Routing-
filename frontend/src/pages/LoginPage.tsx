import { type FormEvent, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ArrowBackRounded as ArrowBackRoundedIcon,
  CheckCircleRounded as CheckCircleRoundedIcon,
  KeyboardArrowDownRounded as KeyboardArrowDownRoundedIcon,
  LockRounded as LockRoundedIcon,
  VisibilityOffRounded as VisibilityOffRoundedIcon,
  VisibilityRounded as VisibilityRoundedIcon,
} from '@mui/icons-material';
import { TopoShellBackground } from '../components/TopoShellBackground';
import { trovanBrandAssets, trovanColors } from '../theme/designTokens';
import {
  beginWorkosLogin,
  isAuthBypassed,
  isDriverOnlyAuthUser,
  login,
  useAuthConfigQuery,
} from '../services/api.session';
import { applyPageMetadata } from '../utils/pageMetadata';
import publicSeo from './public-site/publicSeo.json';

const supportHref = 'mailto:support@trytrovan.com?subject=Trovan%20access%20or%20login%20help';
const currentWorkspaceScreenshot = '/marketing/product-routing.png';
const AUTH_CONFIG_UI_TIMEOUT_MS = 10_000;
const loginSeo = publicSeo['/login'];

function getFriendlyLoginError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/timed out|backend|network|failed to fetch|unavailable/i.test(message)) {
    return 'We could not reach Trovan sign-in. Retry in a moment or request access/support.';
  }
  return message || 'Login failed. Check your credentials or request access/support.';
}

function ProductProof() {
  return (
    <Box
      data-testid="login-product-proof"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 3,
        p: 4.5,
        position: 'relative',
        overflow: 'hidden',
        bgcolor: trovanColors.brand.navy950,
        color: '#FFFFFF',
      }}
    >
      <TopoShellBackground active tone="black" quiet />
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Box
          component={RouterLink}
          to="/"
          aria-label="Trovan home"
          sx={{ display: 'inline-flex', textDecoration: 'none' }}
        >
          <Box
            component="img"
            src={trovanBrandAssets.logoHorizontal}
            alt="Trovan Dispatch"
            width={1120}
            height={260}
            sx={{ display: 'block', width: 215, height: 'auto' }}
          />
        </Box>
        <Typography
          component="p"
          sx={{
            mt: 3.5,
            color: trovanColors.copper[200],
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: '0.11em',
            textTransform: 'uppercase',
          }}
        >
          Route-day command center
        </Typography>
        <Typography
          component="p"
          sx={{
            mt: 1,
            maxWidth: 560,
            color: '#FFFFFF',
            fontSize: 'clamp(2rem, 3vw, 3.25rem)',
            fontWeight: 760,
            letterSpacing: '-0.045em',
            lineHeight: 0.98,
          }}
        >
          Run every route from one calm command center.
        </Typography>
        <Typography
          sx={{
            mt: 1.5,
            maxWidth: 540,
            color: alpha('#FFFFFF', 0.68),
            fontSize: 16,
            lineHeight: 1.55,
          }}
        >
          Plan routes, coordinate drivers, resolve exceptions, and keep delivery
          evidence connected from draft to proof.
        </Typography>
      </Box>

      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          border: `1px solid ${alpha(trovanColors.copper[300], 0.28)}`,
          borderRadius: 2,
          bgcolor: alpha(trovanColors.black[950], 0.82),
          boxShadow: '0 28px 70px rgba(0, 0, 0, 0.36)',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            minHeight: 42,
            px: 1.4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            borderBottom: `1px solid ${alpha('#FFFFFF', 0.1)}`,
          }}
        >
          <Stack direction="row" spacing={0.8} alignItems="center">
            <Box
              sx={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                bgcolor: trovanColors.copper[400],
                boxShadow: `0 0 0 4px ${alpha(trovanColors.copper[400], 0.14)}`,
              }}
            />
            <Typography sx={{ color: '#FFFFFF', fontSize: 12, fontWeight: 850 }}>
              Current Trovan workspace
            </Typography>
          </Stack>
          <Typography sx={{ color: alpha('#FFFFFF', 0.52), fontSize: 11 }}>
            Planning · dispatch · proof
          </Typography>
        </Box>
        <Box component="picture" sx={{ display: 'block', bgcolor: '#FFFFFF' }}>
          <source
            srcSet="/marketing/product-routing-768.webp 768w, /marketing/product-routing.webp 1440w"
            sizes="(min-width: 1100px) 54vw, 0px"
            type="image/webp"
          />
          <Box
            component="img"
            src={currentWorkspaceScreenshot}
            srcSet={`${currentWorkspaceScreenshot} 1440w`}
            sizes="(min-width: 1100px) 54vw, 0px"
            alt="Current Trovan route planning workspace with unassigned jobs, route lanes, map context, and publish controls"
            decoding="async"
            fetchPriority="high"
            width={1440}
            height={900}
            sx={{ display: 'block', width: '100%', height: 'auto' }}
          />
        </Box>
      </Box>

      <Stack
        direction="row"
        spacing={2}
        sx={{ position: 'relative', zIndex: 1, flexWrap: 'wrap', rowGap: 1 }}
      >
        {['Approved pilot access', 'Organization SSO', 'Route data stays scoped'].map(
          (label) => (
            <Stack key={label} direction="row" spacing={0.7} alignItems="center">
              <CheckCircleRoundedIcon sx={{ color: trovanColors.copper[300], fontSize: 17 }} />
              <Typography sx={{ color: alpha('#FFFFFF', 0.7), fontSize: 12.5 }}>
                {label}
              </Typography>
            </Stack>
          ),
        )}
      </Stack>
    </Box>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showLocalLogin, setShowLocalLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authCheckTimedOut, setAuthCheckTimedOut] = useState(false);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const showProductProof = useMediaQuery('(min-width:1100px)', { noSsr: true });
  const authBypassed = isAuthBypassed();
  const authConfigQuery = useAuthConfigQuery();
  const authConfig = authConfigQuery.data;
  const providerReady =
    authConfig?.preferredProvider === 'workos' &&
    authConfig.enabled &&
    authConfig.workos.clientIdConfigured;
  const backendUnavailable =
    !authBypassed && (authConfigQuery.isError || authCheckTimedOut);
  const signInMisconfigured =
    !authBypassed &&
    authConfigQuery.isSuccess &&
    !providerReady &&
    !authConfig?.localLoginAllowed;
  const signInUnavailable = backendUnavailable || signInMisconfigured;
  const checkingSignIn =
    !authBypassed &&
    !authCheckTimedOut &&
    !authConfig &&
    (authConfigQuery.isLoading || authConfigQuery.isFetching);
  const localLoginAllowed = Boolean(authConfig?.localLoginAllowed);
  const localLoginVisible =
    localLoginAllowed && (!providerReady || showLocalLogin);

  useEffect(
    () =>
      applyPageMetadata({
        title: loginSeo.title,
        description: loginSeo.description,
        canonicalUrl: 'https://trytrovan.com/login',
      }),
    [],
  );

  useEffect(() => {
    if (
      authBypassed ||
      authConfig ||
      authConfigQuery.isError
    ) {
      setAuthCheckTimedOut(false);
      return undefined;
    }

    if (!authConfigQuery.isLoading && !authConfigQuery.isFetching) {
      return undefined;
    }

    const timeout = window.setTimeout(
      () => setAuthCheckTimedOut(true),
      AUTH_CONFIG_UI_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [
    authBypassed,
    authConfig,
    authConfigQuery.isError,
    authConfigQuery.isFetching,
    authConfigQuery.isLoading,
  ]);

  const retryAuthConfig = () => {
    if (authCheckTimedOut) {
      window.location.reload();
      return;
    }
    void authConfigQuery.refetch();
  };

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
      component="main"
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        p: { xs: 1.5, sm: 3, lg: 4 },
        position: 'relative',
        overflowX: 'hidden',
        bgcolor: trovanColors.black[950],
        background:
          `radial-gradient(circle at 18% 10%, ${alpha(trovanColors.copper[500], 0.18)}, transparent 28%), linear-gradient(145deg, ${trovanColors.brand.navy950} 0%, ${trovanColors.brand.navy850} 52%, ${trovanColors.brand.navy950} 100%)`,
      }}
    >
      <TopoShellBackground active tone="black" />
      <Card
        sx={{
          maxWidth: showProductProof ? 1180 : 520,
          width: '100%',
          minHeight: showProductProof ? 680 : 'auto',
          display: 'grid',
          gridTemplateColumns: showProductProof ? '1.12fr 0.88fr' : '1fr',
          borderRadius: { xs: 2, sm: 3 },
          position: 'relative',
          zIndex: 1,
          overflow: 'hidden',
          bgcolor: '#FFFFFF',
          borderColor: alpha(trovanColors.copper[500], 0.28),
          boxShadow: '0 36px 110px rgba(0, 0, 0, 0.42)',
        }}
      >
        {showProductProof ? <ProductProof /> : null}
        <Box
          sx={{
            minWidth: 0,
            px: { xs: 2.5, sm: 5 },
            py: { xs: 3, sm: 4.5 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            bgcolor: '#FFFFFF',
            color: trovanColors.black[950],
          }}
        >
          <Box sx={{ width: '100%', maxWidth: 430, mx: 'auto' }}>
            <Button
              component={RouterLink}
              to="/"
              variant="text"
              size="small"
              startIcon={<ArrowBackRoundedIcon />}
              sx={{ ml: -1, mb: 2, color: trovanColors.stone[600] }}
            >
              Back to TryTrovan.com
            </Button>
            {!showProductProof ? (
              <Box
                component="img"
                src={trovanBrandAssets.logoHorizontal}
                alt="Trovan Dispatch"
                width={1120}
                height={260}
                sx={{
                  width: 210,
                  maxWidth: '72%',
                  height: 'auto',
                  display: 'block',
                  mb: 2.8,
                  p: 1,
                  borderRadius: 1,
                  bgcolor: trovanColors.brand.navy950,
                }}
              />
            ) : null}
            <Typography
              sx={{
                color: trovanColors.copper[700],
                fontSize: 11.5,
                fontWeight: 900,
                letterSpacing: '0.11em',
                textTransform: 'uppercase',
              }}
            >
              Approved pilot access
            </Typography>
            <Typography
              component="h1"
              sx={{
                mt: 0.8,
                color: trovanColors.black[950],
                fontSize: { xs: 34, sm: 42 },
                fontWeight: 760,
                letterSpacing: '-0.04em',
                lineHeight: 1,
              }}
            >
            Welcome back
          </Typography>
            <Typography
              sx={{
                mt: 1.2,
                mb: 2.6,
                color: trovanColors.stone[600],
                fontSize: 15.5,
                lineHeight: 1.55,
              }}
            >
              Sign in to your Trovan workspace. Access is provisioned for
              approved pilot organizations.
          </Typography>

          {authBypassed && (
              <Alert severity="info" sx={{ mb: 2 }} data-testid="login-preview-state">
                Local preview mode is enabled. Open the driver demo without
                production credentials.
            </Alert>
          )}

          {checkingSignIn ? (
              <Stack
                direction="row"
                spacing={1.2}
                alignItems="center"
                role="status"
                aria-live="polite"
                aria-label="Checking sign-in availability"
                sx={{
                  minHeight: 48,
                  mb: 2,
                  px: 1.5,
                  borderRadius: 1,
                  border: `1px solid ${trovanColors.stone[200]}`,
                  bgcolor: trovanColors.stone[25],
                }}
                data-testid="login-loading"
              >
                <CircularProgress size={17} />
                <Typography sx={{ color: trovanColors.stone[600], fontSize: 14 }}>
                  Checking secure sign-in…
                </Typography>
              </Stack>
          ) : null}

            {signInUnavailable ? (
            <Alert severity="warning" sx={{ mb: 2 }} data-testid="login-unavailable">
              <Typography sx={{ fontWeight: 800, mb: 0.5 }}>
                Sign-in is temporarily unavailable.
              </Typography>
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                  {signInMisconfigured
                    ? 'Secure sign-in is not configured for this environment. Retry after configuration is restored or contact support.'
                    : 'Trovan could not reach the authentication service. Your route workspace is safe; try again or contact support.'}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={retryAuthConfig}
                  disabled={authConfigQuery.isFetching && !authCheckTimedOut}
                >
                  {authConfigQuery.isFetching && !authCheckTimedOut
                    ? 'Checking...'
                    : 'Retry'}
                </Button>
                  <Button component="a" href={supportHref} variant="outlined" size="small">
                    Contact support
                </Button>
              </Stack>
            </Alert>
          ) : null}

          {error && (
              <Alert id="login-error" severity="error" role="alert" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

            {providerReady && !signInUnavailable ? (
            <Button
              variant="contained"
              fullWidth
              size="large"
                startIcon={<LockRoundedIcon />}
              sx={{
                  minHeight: 48,
              }}
              disabled={loading}
              onClick={handleWorkosLogin}
                aria-busy={loading}
            >
                {loading ? 'Opening secure sign-in…' : 'Continue with SSO'}
            </Button>
          ) : null}

            {providerReady &&
            authConfig?.workos.mfaManagedByProvider &&
            !signInUnavailable ? (
              <Stack direction="row" spacing={0.7} alignItems="center" sx={{ mt: 1.2 }}>
                <LockRoundedIcon sx={{ color: trovanColors.semantic.success, fontSize: 16 }} />
                <Typography sx={{ color: trovanColors.stone[600], fontSize: 12.5 }}>
                  Your organization&apos;s SSO and MFA policies apply.
                </Typography>
              </Stack>
          ) : null}

          {authBypassed ? (
            <Button
              variant="contained"
              fullWidth
              size="large"
                sx={{ mt: 0.5, minHeight: 48 }}
              disabled={loading}
              onClick={handlePreviewLogin}
              data-testid="login-demo"
            >
              {loading ? 'Opening demo...' : 'Open Driver Demo'}
            </Button>
          ) : null}

            {providerReady && localLoginAllowed && !signInUnavailable ? (
              <>
                <Divider sx={{ my: 2.2 }}>or</Divider>
                <Button
                  variant="text"
                  fullWidth
                  endIcon={
                    <KeyboardArrowDownRoundedIcon
                      sx={{
                        transition: 'transform 160ms ease',
                        transform: showLocalLogin ? 'rotate(180deg)' : 'none',
                      }}
                    />
                  }
                  aria-expanded={showLocalLogin}
                  aria-controls="local-admin-login"
                  onClick={() => setShowLocalLogin((visible) => !visible)}
                >
                  Use local admin login
                </Button>
              </>
            ) : null}

            <Collapse in={localLoginVisible} timeout="auto" unmountOnExit>
              <Box
                id="local-admin-login"
                component="form"
                onSubmit={handleSubmit}
                data-testid="login-form"
                sx={{ pt: providerReady ? 1 : 0 }}
              >
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                margin="normal"
                required
                  autoComplete="username"
                  name="email"
                  inputProps={{
                    'data-testid': 'login-email',
                    'aria-describedby': error ? 'login-error' : undefined,
                  }}
              />
              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
                required
                  autoComplete="current-password"
                  name="password"
                  inputProps={{
                    'data-testid': 'login-password',
                    'aria-describedby': error ? 'login-error' : undefined,
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          edge="end"
                          aria-label={
                            showPassword ? 'Hide password' : 'Show password'
                          }
                          onClick={() =>
                            setShowPassword((visible) => !visible)
                          }
                          onMouseDown={(event) => event.preventDefault()}
                        >
                          {showPassword ? (
                            <VisibilityOffRoundedIcon />
                          ) : (
                            <VisibilityRoundedIcon />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
              />
              <Button
                type="submit"
                variant="outlined"
                fullWidth
                size="large"
                sx={{
                    mt: 2,
                    minHeight: 48,
                }}
                disabled={loading}
                data-testid="login-submit"
                  aria-busy={loading}
              >
                  {loading ? 'Signing in…' : 'Sign in with email'}
              </Button>
              </Box>
            </Collapse>

            {!authBypassed ? (
              <Box
                sx={{
                  mt: 2.8,
                  pt: 2.2,
                  borderTop: `1px solid ${trovanColors.stone[200]}`,
                }}
              >
                <Typography sx={{ color: trovanColors.stone[700], fontSize: 13.5 }}>
                  Need access?{' '}
                  <Link
                    component={RouterLink}
                    to="/support"
                    underline="hover"
                    sx={{ color: trovanColors.copper[700], fontWeight: 800 }}
                  >
                    Request onboarding
                  </Link>
                </Typography>
                <Typography sx={{ mt: 0.8, color: trovanColors.stone[600], fontSize: 13 }}>
                  Having trouble signing in?{' '}
                  <Link
                    component={RouterLink}
                    to="/support"
                    underline="hover"
                    sx={{ color: trovanColors.copper[700], fontWeight: 800 }}
                  >
                    Contact support
                  </Link>
                </Typography>
              </Box>
            ) : null}

            <Stack
              component="footer"
              direction="row"
              spacing={2}
              sx={{ mt: 3.2, flexWrap: 'wrap', rowGap: 0.8 }}
            >
              {[
                ['Privacy', '/legal/privacy'],
                ['Terms', '/legal/terms'],
                ['Security', '/security'],
              ].map(([label, href]) => (
                <Link
                  key={href}
                  component={RouterLink}
                  to={href}
                  underline="hover"
                  sx={{ color: trovanColors.stone[500], fontSize: 12 }}
                >
                  {label}
                </Link>
              ))}
            </Stack>
          </Box>
        </Box>
      </Card>
    </Box>
  );
}
