import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Badge,
  Button,
  Grid,
  Card,
  CardContent,
  Paper,
  Chip,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import {
  Route as RouteIcon,
  AutoAwesome,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { getRoutes, getVehicles, getDrivers } from '../services/api';
import { connectDispatchRealtime } from '../services/socket';

interface Route {
  id: string;
  vehicleId?: string;
  driverId?: string;
  jobIds?: string[];
  status: string;
  totalDistance?: number;
  totalDuration?: number;
  conflicts?: string[];
}

interface Vehicle {
  id: string;
  make?: string;
  model?: string;
  licensePlate?: string;
  status?: string;
}

interface Driver {
  id: string;
  firstName?: string;
  lastName?: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function RoutesConsolidated() {
  const [activeTab, setActiveTab] = useState(0);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter routes by status and conflicts
  const activeRoutes = routes.filter(
    (r) => r.status === 'planned' || r.status === 'assigned' || r.status === 'in_progress'
  );
  const conflictingRoutes = routes.filter((r) => r.conflicts && r.conflicts.length > 0);

  useEffect(() => {
    loadAllData();

    const eventSource = connectDispatchRealtime((data) => {
      if (data.type === 'route-created' || data.type === 'route-updated') {
        loadAllData();
      }
    });

    return () => eventSource.close();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [routesData, vehiclesData, driversData] = await Promise.all([
        getRoutes(),
        getVehicles(),
        getDrivers(),
      ]);

      setRoutes(routesData as Route[]);
      setVehicles(vehiclesData);
      setDrivers(driversData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getVehicleName = (vehicleId?: string) => {
    if (!vehicleId) return 'Unassigned';
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    return vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown Vehicle';
  };

  const getDriverName = (driverId?: string) => {
    if (!driverId) return 'Unassigned';
    const driver = drivers.find((d) => d.id === driverId);
    return driver ? `${driver.firstName} ${driver.lastName}` : 'Unknown Driver';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned':
        return 'info';
      case 'assigned':
        return 'primary';
      case 'in_progress':
        return 'warning';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4">Routes</Typography>
          <Typography variant="body2" color="text.secondary">
            View, optimize, and manage all routes
          </Typography>
        </Box>
        <Box>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadAllData} sx={{ mr: 1 }}>
            Refresh
          </Button>
          <Button variant="contained" startIcon={<AddIcon />}>
            Create Route
          </Button>
        </Box>
      </Box>

      {/* Tabs Navigation */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab
            label={
              <Badge badgeContent={activeRoutes.length} color="primary">
                <Box sx={{ mr: 2 }}>Active Routes</Box>
              </Badge>
            }
          />
          <Tab label="Optimization" />
          <Tab
            label={
              <Badge
                badgeContent={conflictingRoutes.length}
                color={conflictingRoutes.length > 0 ? 'error' : 'success'}
              >
                <Box sx={{ mr: 2 }}>Conflicts</Box>
              </Badge>
            }
          />
        </Tabs>
      </Paper>

      {/* Tab 0: Active Routes */}
      <TabPanel value={activeTab} index={0}>
        <Box sx={{ mb: 3 }}>
          <Button variant="contained" startIcon={<AutoAwesome />} sx={{ mr: 1 }}>
            Auto-Generate Routes
          </Button>
          <Button variant="outlined" startIcon={<AddIcon />}>
            Create Manual Route
          </Button>
        </Box>

        {/* Metrics Summary */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h4">{activeRoutes.length}</Typography>
              <Typography variant="body2" color="text.secondary">
                Active Routes
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h4">
                {vehicles.filter((v) => v.status === 'AVAILABLE' || v.status === 'available').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Available Vehicles
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h4">
                {routes.filter((r) => !r.jobIds || r.jobIds.length === 0).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Pending Jobs
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h4">
                {routes.filter((r) => r.status === 'completed').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Completed Today
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Routes List */}
        <Grid container spacing={2}>
          {activeRoutes.map((route) => (
            <Grid item xs={12} md={6} lg={4} key={route.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6">Route {route.id.slice(0, 8)}</Typography>
                    <Chip
                      label={route.status}
                      color={getStatusColor(route.status) as any}
                      size="small"
                    />
                  </Box>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Vehicle:</strong> {getVehicleName(route.vehicleId)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Driver:</strong> {getDriverName(route.driverId)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Stops:</strong> {route.jobIds?.length || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Distance:</strong> {route.totalDistance?.toFixed(1) || 0} km
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <Button variant="outlined" size="small" startIcon={<EditIcon />} fullWidth>
                      Edit
                    </Button>
                    <Button variant="outlined" size="small" color="error" startIcon={<DeleteIcon />} fullWidth>
                      Delete
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {activeRoutes.length === 0 && (
          <Alert severity="info">No active routes. Create a route to get started.</Alert>
        )}
      </TabPanel>

      {/* Tab 1: Optimization */}
      <TabPanel value={activeTab} index={1}>
        <Box textAlign="center" py={6}>
          <RouteIcon sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Route Optimization
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Drag and drop stops to manually optimize routes, or use AI-powered optimization
          </Typography>
          <Button variant="contained" startIcon={<AutoAwesome />} size="large">
            Auto-Optimize All Routes
          </Button>
        </Box>

        {/* Placeholder for drag-and-drop interface */}
        <Alert severity="info" sx={{ mt: 3 }}>
          <AlertTitle>Coming Soon</AlertTitle>
          Drag-and-drop route optimization interface with real-time distance calculations will be available
          here. For now, use the Route Optimization page for advanced editing.
        </Alert>
      </TabPanel>

      {/* Tab 2: Conflicts */}
      <TabPanel value={activeTab} index={2}>
        {conflictingRoutes.length === 0 ? (
          <Alert severity="success" icon={<CheckIcon />}>
            <AlertTitle>No Conflicts</AlertTitle>
            All routes are optimized and ready for dispatch.
          </Alert>
        ) : (
          <Box>
            <Typography variant="h6" gutterBottom>
              {conflictingRoutes.length} Route(s) with Issues
            </Typography>
            <List>
              {conflictingRoutes.map((route) => (
                <Paper key={route.id} sx={{ mb: 2 }}>
                  <ListItem>
                    <WarningIcon color="error" sx={{ mr: 2 }} />
                    <ListItemText
                      primary={`Route ${route.id.slice(0, 8)} - ${getVehicleName(route.vehicleId)}`}
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Driver: {getDriverName(route.driverId)}
                          </Typography>
                          <Typography variant="body2" color="error.main" sx={{ mt: 1 }}>
                            <strong>Issues:</strong>
                          </Typography>
                          <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                            {route.conflicts?.map((conflict, idx) => (
                              <li key={idx}>{conflict}</li>
                            ))}
                          </ul>
                        </Box>
                      }
                    />
                    <Button variant="contained" size="small">
                      Resolve
                    </Button>
                  </ListItem>
                </Paper>
              ))}
            </List>
          </Box>
        )}
      </TabPanel>
    </Box>
  );
}
