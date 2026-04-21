import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Button, Grid, List, ListItem, ListItemText, Stack, TextField, Typography } from '@mui/material';
import { PageHeader } from '../components/PageHeader';
import { SurfacePanel } from '../components/SurfacePanel';
import {
  createOrganization,
  getCurrentOrganization,
  getDrivers,
  getOrganizations,
  getTrackingReadiness,
  getVehicles,
  type OrganizationRecord,
  type TrackingReadiness,
} from '../services/api';

const roles = ['OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER', 'DRIVER'];

export default function SettingsPage() {
  const [currentOrganization, setCurrentOrganization] = useState<OrganizationRecord | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [driverCount, setDriverCount] = useState(0);
  const [vehicleCount, setVehicleCount] = useState(0);
  const [trackingReadiness, setTrackingReadiness] = useState<TrackingReadiness | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [current, all, drivers, vehicles, readiness] = await Promise.all([
        getCurrentOrganization(),
        getOrganizations(),
        getDrivers(),
        getVehicles(),
        getTrackingReadiness(),
      ]);
      setCurrentOrganization(current);
      setOrganizations(all);
      setDriverCount(Array.isArray(drivers) ? drivers.length : 0);
      setVehicleCount(Array.isArray(vehicles) ? vehicles.length : 0);
      setTrackingReadiness(readiness);
    } catch (err: any) {
      setError(err?.message || 'Failed to load organization settings.');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      await createOrganization({ name, slug: slug || undefined, serviceTimezone: timezone || undefined });
      setName('');
      setSlug('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to create organization.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      <PageHeader eyebrow="System" title="Settings" subtitle="Organization setup, tracking readiness, and operator controls are wired into the live product foundation." />
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={6}>
          <SurfacePanel>
            <Typography variant="h5">Current Organization</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {currentOrganization ? `${currentOrganization.name} (${currentOrganization.slug})` : 'No organization selected.'}
            </Typography>
            {currentOrganization?.membership ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Role: {currentOrganization.membership.role}
              </Typography>
            ) : null}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Timezone: {currentOrganization?.serviceTimezone || 'UTC'}
            </Typography>
          </SurfacePanel>
        </Grid>
        <Grid item xs={12} md={6}>
          <SurfacePanel>
            <Typography variant="h5">Create Organization</Typography>
            <Stack spacing={1.5} sx={{ mt: 1.5 }}>
              <TextField label="Organization name" value={name} onChange={(event) => setName(event.target.value)} />
              <TextField label="Slug" value={slug} onChange={(event) => setSlug(event.target.value)} />
              <TextField label="Timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} />
              <Button variant="contained" onClick={handleCreate} disabled={saving || !name.trim()}>
                Create organization
              </Button>
            </Stack>
          </SurfacePanel>
        </Grid>
        <Grid item xs={12} md={6}>
          <SurfacePanel>
            <Typography variant="h5">Operational Readiness</Typography>
            <List disablePadding sx={{ mt: 1 }}>
              <ListItem disableGutters sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                <ListItemText primary="Drivers" secondary={`${driverCount} active driver records available for routing and dispatch`} />
              </ListItem>
              <ListItem disableGutters sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                <ListItemText primary="Vehicles" secondary={`${vehicleCount} fleet records available for assignment and tracking`} />
              </ListItem>
              <ListItem disableGutters>
                <ListItemText
                  primary="Tracking"
                  secondary={
                    trackingReadiness
                      ? `${trackingReadiness.summary.vehiclesTracked} vehicles reporting • ${trackingReadiness.summary.activeVehicles} active now`
                      : 'Telemetry readiness unavailable'
                  }
                />
              </ListItem>
            </List>
            <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap">
              <Button component={RouterLink} to="/drivers" variant="outlined">Drivers</Button>
              <Button component={RouterLink} to="/vehicles" variant="outlined">Vehicles</Button>
              <Button component={RouterLink} to="/tracking" variant="contained">Open Tracking</Button>
            </Stack>
          </SurfacePanel>
        </Grid>
        <Grid item xs={12} md={6}>
          <SurfacePanel>
            <Typography variant="h5">Roles</Typography>
            <List disablePadding sx={{ mt: 1 }}>
              {roles.map((role) => (
                <ListItem key={role} disableGutters sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                  <ListItemText primary={role} secondary="Permission-enforced in backend routes and planner actions" />
                </ListItem>
              ))}
            </List>
          </SurfacePanel>
        </Grid>
        <Grid item xs={12} md={6}>
          <SurfacePanel>
            <Typography variant="h5">Organizations</Typography>
            <List disablePadding sx={{ mt: 1 }}>
              {organizations.map((organization) => (
                <ListItem key={organization.id} disableGutters sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                  <ListItemText primary={organization.name} secondary={`${organization.slug} • ${organization.membership?.role || 'member'}`} />
                </ListItem>
              ))}
            </List>
          </SurfacePanel>
        </Grid>
        <Grid item xs={12} md={6}>
          <SurfacePanel>
            <Typography variant="h5">Tracking Setup</Typography>
            <List disablePadding sx={{ mt: 1 }}>
              <ListItem disableGutters sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                <ListItemText primary="1. Prepare drivers and vehicles" secondary="Make sure every active driver has a vehicle assignment path before dispatch." />
              </ListItem>
              <ListItem disableGutters sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                <ListItemText primary="2. Send telemetry" secondary="Post GPS pings to `/api/tracking/ingest` from mobile or device middleware using the assigned vehicle ID." />
              </ListItem>
              <ListItem disableGutters>
                <ListItemText primary="3. Monitor execution" secondary="Use Tracking for live signals and Dispatch for route-run status, stop progress, and exception handling." />
              </ListItem>
            </List>
          </SurfacePanel>
        </Grid>
      </Grid>
    </Stack>
  );
}
