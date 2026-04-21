import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { PageHeader } from '../components/PageHeader';
import { SurfacePanel } from '../components/SurfacePanel';
import LoadingState from '../components/ui/LoadingState';
import { listExceptionsV2, updateExceptionV2, type DispatchExceptionRecord } from '../features/dispatch/api/routeRunsApi';

function statusColor(status: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  const normalized = String(status || '').toLowerCase();
  if (['resolved'].includes(normalized)) return 'success';
  if (['failed', 'cancelled'].includes(normalized)) return 'error';
  if (['acknowledged'].includes(normalized)) return 'info';
  if (['open', 'rescheduled'].includes(normalized)) return 'warning';
  return 'default';
}

export default function ExceptionsQueuePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DispatchExceptionRecord[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'>('ALL');

  const loadExceptions = async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listExceptionsV2());
    } catch (err: any) {
      setError(err?.message || 'Failed to load exceptions queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadExceptions();
  }, []);

  const visibleItems = items.filter((item) => filter === 'ALL' ? true : item.status === filter);

  const handleUpdate = async (exceptionId: string, status: 'ACKNOWLEDGED' | 'RESOLVED') => {
    setError(null);
    try {
      await updateExceptionV2(exceptionId, status);
      await loadExceptions();
    } catch (err: any) {
      setError(err?.message || 'Failed to update exception.');
    }
  };

  if (loading) {
    return <LoadingState label="Loading exceptions queue..." minHeight="50vh" />;
  }

  return (
    <Box>
      <PageHeader
        eyebrow="Dispatch"
        title="Exceptions Queue"
        subtitle="Acknowledge or resolve failed and rescheduled work without leaving the execution workflow."
        actions={<Button component={RouterLink} to="/dispatch" variant="outlined">Back to Dispatch</Button>}
      />
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      <SurfacePanel>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
          <TextField select label="Status filter" value={filter} onChange={(event) => setFilter(event.target.value as any)} sx={{ minWidth: 220 }}>
            <MenuItem value="ALL">All</MenuItem>
            <MenuItem value="OPEN">Open</MenuItem>
            <MenuItem value="ACKNOWLEDGED">Acknowledged</MenuItem>
            <MenuItem value="RESOLVED">Resolved</MenuItem>
          </TextField>
          <Typography variant="body2" color="text.secondary">{visibleItems.length} exceptions shown</Typography>
        </Stack>
        <List disablePadding>
          {visibleItems.map((item) => (
            <ListItem key={item.id} disableGutters sx={{ py: 2, borderBottom: '1px solid', borderColor: 'divider', alignItems: 'flex-start' }}>
              <ListItemText
                primary={`${item.code} • ${item.message}`}
                secondary={[
                  item.routeId ? `Route ${item.routeId.slice(0, 8)}` : null,
                  item.routeRunStopId ? `Stop ${item.routeRunStopId.slice(0, 8)}` : null,
                  item.createdAt || null,
                ].filter(Boolean).join(' • ')}
              />
              <Stack alignItems="flex-end" spacing={1}>
                <Chip label={item.status} color={statusColor(item.status)} />
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="outlined" disabled={item.status !== 'OPEN'} onClick={() => void handleUpdate(item.id, 'ACKNOWLEDGED')}>Acknowledge</Button>
                  <Button size="small" variant="contained" disabled={item.status === 'RESOLVED'} onClick={() => void handleUpdate(item.id, 'RESOLVED')}>Resolve</Button>
                  {item.routeId ? <Button size="small" component={RouterLink} to={`/route-runs/${item.routeId}`}>Open route</Button> : null}
                </Stack>
              </Stack>
            </ListItem>
          ))}
          {visibleItems.length === 0 ? <Typography variant="body2" color="text.secondary">No exceptions match the current filter.</Typography> : null}
        </List>
      </SurfacePanel>
    </Box>
  );
}
