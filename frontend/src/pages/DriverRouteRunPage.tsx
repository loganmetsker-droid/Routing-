import { useState } from 'react';
import { Box, Button, Chip, Grid, Stack, TextField, Typography } from '@mui/material';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { SurfacePanel } from '../components/SurfacePanel';
import LoadingState from '../components/ui/LoadingState';
import {
  getRouteRunsErrorMessage,
  useRouteRunDetailQuery,
  useRouteRunStopMutation,
} from '../features/dispatch/api/routeRunsApi';

function statusColor(status: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  const normalized = String(status || '').toLowerCase();
  if (['completed', 'serviced'].includes(normalized)) return 'success';
  if (['failed', 'cancelled'].includes(normalized)) return 'error';
  if (['in_progress', 'assigned', 'arrived'].includes(normalized)) return 'info';
  if (['planned', 'pending', 'ready_for_dispatch'].includes(normalized)) return 'warning';
  return 'default';
}

export default function DriverRouteRunPage() {
  const { id = '' } = useParams();
  const routeRunQuery = useRouteRunDetailQuery(id);
  const stopMutation = useRouteRunStopMutation();
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const detail = routeRunQuery.data ?? null;

  if (routeRunQuery.isLoading) {
    return <LoadingState label="Loading route run..." minHeight="50vh" />;
  }

  if (!detail?.routeRun) {
    return (
      <SurfacePanel>
        <Typography variant="h5">Route run unavailable</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          The requested route run could not be loaded for this driver.
        </Typography>
      </SurfacePanel>
    );
  }

  return (
    <Stack spacing={2.5}>
      <SurfacePanel sx={{ bgcolor: 'rgba(31, 26, 23, 0.96)', color: '#fff' }}>
        <Stack spacing={1.25}>
          <Typography variant="overline" sx={{ opacity: 0.72 }}>
            Driver Execution
          </Typography>
          <Typography variant="h4">Route {detail.routeRun.id.slice(0, 8)}</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip label={detail.routeRun.status} color={statusColor(detail.routeRun.status)} />
            <Chip label={`${detail.stops.length} stops`} variant="outlined" sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.35)' }} />
          </Stack>
          <Button component={RouterLink} to="/driver" variant="outlined" sx={{ alignSelf: 'flex-start', color: '#fff', borderColor: 'rgba(255,255,255,0.35)' }}>
            Back to manifest
          </Button>
        </Stack>
      </SurfacePanel>

      {error ? (
        <SurfacePanel>
          <Typography variant="body2" color="error.main">{error}</Typography>
        </SurfacePanel>
      ) : null}

      <Grid container spacing={2.5}>
        {(detail.stops || []).map((stop) => (
          <Grid item xs={12} key={stop.id}>
            <SurfacePanel>
              <Stack spacing={1.5}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
                  <Box>
                    <Typography variant="h5">Stop {stop.stopSequence}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Job {stop.jobId.slice(0, 8)} • Planned {stop.plannedArrival || 'pending'}
                    </Typography>
                  </Box>
                  <Chip label={stop.status} color={statusColor(stop.status)} />
                </Stack>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                  <Button
                    variant="outlined"
                    onClick={() =>
                      stopMutation
                        .mutateAsync({
                          routeRunId: id,
                          stopId: stop.id,
                          kind: 'arrived',
                        })
                        .catch((err: unknown) =>
                          setError(getRouteRunsErrorMessage(err)),
                        )
                    }
                  >
                    Arrived
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={() =>
                      stopMutation
                        .mutateAsync({
                          routeRunId: id,
                          stopId: stop.id,
                          kind: 'serviced',
                        })
                        .catch((err: unknown) =>
                          setError(getRouteRunsErrorMessage(err)),
                        )
                    }
                  >
                    Complete Stop
                  </Button>
                </Stack>
                <TextField
                  label="Driver note"
                  value={noteDrafts[stop.id] || ''}
                  onChange={(event) =>
                    setNoteDrafts((current) => ({
                      ...current,
                      [stop.id]: event.target.value,
                    }))
                  }
                  fullWidth
                  multiline
                  minRows={2}
                />
                <Button
                  variant="text"
                  onClick={() =>
                    stopMutation
                      .mutateAsync({
                        routeRunId: id,
                        stopId: stop.id,
                        kind: 'note',
                        value: noteDrafts[stop.id] || '',
                      })
                      .then(() =>
                        setNoteDrafts((current) => ({
                          ...current,
                          [stop.id]: '',
                        }))
                      )
                      .catch((err: unknown) =>
                        setError(getRouteRunsErrorMessage(err)),
                      )
                  }
                  disabled={!noteDrafts[stop.id]?.trim()}
                >
                  Save note
                </Button>
              </Stack>
            </SurfacePanel>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
