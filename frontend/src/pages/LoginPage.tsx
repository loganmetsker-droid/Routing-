import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Divider,
  TextField,
  Button,
  Typography,
  Alert,
  Stack,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import StatusPill from '../components/ui/StatusPill';
import { moduleAccents } from '../theme/tokens';
import { isAuthBypassed, login } from '../services/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const authBypassed = isAuthBypassed();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      setLoading(true);
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
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
      }}
    >
      <Card sx={{ maxWidth: 440, width: '100%', borderRadius: 4 }}>
        <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
            Signal Ops
          </Typography>
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

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

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
              variant="contained"
              fullWidth
              size="large"
              sx={{
                mt: 3,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.95),
              }}
              disabled={loading}
              data-testid="login-submit"
            >
              {loading ? 'Logging in...' : authBypassed ? 'Continue in Preview Mode' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
