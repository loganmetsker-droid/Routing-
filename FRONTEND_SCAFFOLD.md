# Frontend Scaffold - Complete Guide

## What's Been Created

### ✅ Core Infrastructure
1. **Apollo Client Setup** (`src/apollo/client.ts`)
   - GraphQL client configured
   - JWT authentication header injection
   - Error handling
   - Connected to backend at `http://localhost:3000/graphql`

2. **Material-UI Theme** (`src/theme.ts`)
   - Light/dark theme support
   - Custom color palette
   - Typography configuration
   - Component style overrides

3. **Layout Component** (`src/components/Layout.tsx`)
   - Responsive sidebar navigation
   - App bar with menu
   - Drawer for mobile
   - Navigation to: Dashboard, Drivers, Vehicles, Routes, Jobs
   - Logout functionality

4. **Routing Setup** (`src/App.tsx`)
   - React Router v6 configured
   - Protected routes with Layout
   - Public route for Login
   - Routes:
     - `/` - Dashboard
     - `/drivers` - Drivers page
     - `/vehicles` - Vehicles page
     - `/routes` - Routes with map
     - `/jobs` - Jobs page
     - `/login` - Login page

### ✅ GraphQL Integration

**Queries** (`src/graphql/queries.ts`):
- `GET_DRIVERS` - Fetch all drivers
- `GET_DRIVER` - Fetch single driver
- `GET_VEHICLES` - Fetch all vehicles
- `GET_VEHICLES_BY_TYPE` - Filter by type
- `GET_VEHICLES_NEEDING_MAINTENANCE` - Maintenance alerts
- `GET_JOBS` - Fetch all jobs
- `GET_ROUTES` - Fetch all routes
- `GET_ROUTE` - Fetch single route with waypoints

**Mutations** (`src/graphql/mutations.ts`):
- `CREATE_DRIVER`, `UPDATE_DRIVER`
- `CREATE_VEHICLE`, `UPDATE_VEHICLE`
- `CREATE_JOB`, `UPDATE_JOB`
- `CREATE_ROUTE`
- `LOGIN` - Authentication

**Custom Hooks** (`src/graphql/hooks.ts`):
```typescript
useDrivers()                        // Get all drivers
useDriver(id)                       // Get single driver
useVehicles()                       // Get all vehicles
useVehiclesByType(type)            // Filter vehicles
useVehiclesNeedingMaintenance()    // Maintenance alerts
useJobs()                          // Get all jobs
useRoutes()                        // Get all routes
useRoute(id)                       // Get single route
useLogin()                         // Login mutation
```

### 📦 Installed Packages

```json
{
  "@apollo/client": "latest",
  "graphql": "latest",
  "react-router-dom": "^6",
  "@mui/material": "latest",
  "@mui/icons-material": "latest",
  "@emotion/react": "latest",
  "@emotion/styled": "latest",
  "leaflet": "latest",
  "react-leaflet": "latest"
}
```

## Pages to Create

### 1. Dashboard (Already exists)
Shows:
- Total drivers, vehicles, routes, jobs
- Active routes count
- Pending jobs count
- Recent activity feed
- Quick stats

### 2. Drivers Page (`src/pages/DriversPage.tsx`)

**Copy-paste this code:**

```typescript
import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Chip,
  IconButton,
} from '@mui/material';
import { Refresh, Add, Edit } from '@mui/icons-material';
import { useDrivers } from '../graphql/hooks';

export function DriversPage() {
  const { data, loading, refetch } = useDrivers();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  const drivers = data?.drivers || [];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Drivers</Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => refetch()}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button variant="contained" startIcon={<Add />}>
            Add Driver
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>License</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Vehicle</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {drivers.map((driver: any) => (
              <TableRow key={driver.id}>
                <TableCell>{`${driver.firstName} ${driver.lastName}`}</TableCell>
                <TableCell>{driver.email}</TableCell>
                <TableCell>{driver.phone}</TableCell>
                <TableCell>{driver.licenseNumber}</TableCell>
                <TableCell>
                  <Chip
                    label={driver.status}
                    color={driver.status === 'active' ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {driver.currentVehicle
                    ? `${driver.currentVehicle.make} ${driver.currentVehicle.model}`
                    : 'None'}
                </TableCell>
                <TableCell>
                  <IconButton size="small">
                    <Edit fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
```

### 3. Vehicles Page (`src/pages/VehiclesPage.tsx`)

```typescript
import { useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { useVehicles, useVehiclesByType, useVehiclesNeedingMaintenance } from '../graphql/hooks';

export function VehiclesPage() {
  const [tab, setTab] = useState(0);
  const [selectedType, setSelectedType] = useState('truck');

  const { data: allVehicles, loading: loadingAll } = useVehicles();
  const { data: byTypeData, loading: loadingByType } = useVehiclesByType(selectedType);
  const { data: maintenanceData, loading: loadingMaintenance } = useVehiclesNeedingMaintenance();

  const getVehicles = () => {
    if (tab === 0) return allVehicles?.vehicles || [];
    if (tab === 1) return byTypeData?.vehicles || [];
    return maintenanceData?.vehicles || [];
  };

  const loading = loadingAll || loadingByType || loadingMaintenance;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Vehicles
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="All Vehicles" />
        <Tab label="By Type" />
        <Tab label="Needs Maintenance" />
      </Tabs>

      {tab === 1 && (
        <FormControl sx={{ mb: 3, minWidth: 200 }}>
          <InputLabel>Vehicle Type</InputLabel>
          <Select
            value={selectedType}
            label="Vehicle Type"
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <MenuItem value="truck">Truck</MenuItem>
            <MenuItem value="van">Van</MenuItem>
            <MenuItem value="car">Car</MenuItem>
          </Select>
        </FormControl>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {getVehicles().map((vehicle: any) => (
            <Grid item xs={12} sm={6} md={4} key={vehicle.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6">
                    {vehicle.make} {vehicle.model}
                  </Typography>
                  <Typography color="textSecondary" gutterBottom>
                    {vehicle.licensePlate}
                  </Typography>
                  <Chip
                    label={vehicle.status}
                    color={vehicle.status === 'available' ? 'success' : 'warning'}
                    size="small"
                    sx={{ mt: 1 }}
                  />
                  {vehicle.nextMaintenanceDate && (
                    <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                      Maintenance: {new Date(vehicle.nextMaintenanceDate).toLocaleDateString()}
                    </Typography>
                  )}
                </CardContent>
                <CardActions>
                  <Button size="small">View Details</Button>
                  <Button size="small">Edit</Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
```

### 4. Routes Page with Map (`src/pages/RoutesPage.tsx`)

```typescript
import { useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import { Box, Typography, Grid, Card, CardContent, List, ListItem, ListItemText, CircularProgress } from '@mui/material';
import { useRoutes, useRoute } from '../graphql/hooks';
import 'leaflet/dist/leaflet.css';

export function RoutesPage() {
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const { data: routesData, loading: routesLoading } = useRoutes();
  const { data: routeData, loading: routeLoading } = useRoute(selectedRouteId || '');

  const routes = routesData?.routes || [];
  const selectedRoute = routeData?.route;

  // Parse waypoints for selected route
  const waypoints = selectedRoute?.waypoints
    ? JSON.parse(selectedRoute.waypoints).map((wp: any) => [wp.lat, wp.lng])
    : [];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Routes
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Available Routes
              </Typography>
              {routesLoading ? (
                <CircularProgress />
              ) : (
                <List>
                  {routes.map((route: any) => (
                    <ListItem
                      key={route.id}
                      button
                      selected={selectedRouteId === route.id}
                      onClick={() => setSelectedRouteId(route.id)}
                    >
                      <ListItemText
                        primary={`Route ${route.id.substring(0, 8)}`}
                        secondary={`${route.totalDistance}km - ${route.totalDuration}min`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card sx={{ height: 600 }}>
            <CardContent sx={{ height: '100%', p: 0 }}>
              {selectedRoute && waypoints.length > 0 ? (
                <MapContainer
                  center={waypoints[0]}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                  />
                  <Polyline positions={waypoints} color="blue" />
                  {waypoints.map((pos: any, idx: number) => (
                    <Marker key={idx} position={pos}>
                      <Popup>Waypoint {idx + 1}</Popup>
                    </Marker>
                  ))}
                </MapContainer>
              ) : (
                <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                  <Typography color="textSecondary">
                    Select a route to view on map
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
```

### 5. Jobs Page (`src/pages/JobsPage.tsx`)

```typescript
import { Box, Typography, Grid, Card, CardContent, Chip, CircularProgress } from '@mui/material';
import { useJobs } from '../graphql/hooks';

export function JobsPage() {
  const { data, loading } = useJobs();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  const jobs = data?.jobs || [];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Jobs
      </Typography>

      <Grid container spacing={3}>
        {jobs.map((job: any) => (
          <Grid item xs={12} md={6} key={job.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">{job.jobType}</Typography>
                  <Chip
                    label={job.status}
                    color={job.status === 'completed' ? 'success' : 'primary'}
                    size="small"
                  />
                </Box>
                <Typography variant="body2" color="textSecondary">
                  Pickup: {job.scheduledPickupTime}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Delivery: {job.scheduledDeliveryTime}
                </Typography>
                {job.notes && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Notes: {job.notes}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
```

### 6. Login Page (`src/pages/LoginPage.tsx`)

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
} from '@mui/material';
import { useLogin } from '../graphql/hooks';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [login, { loading, error }] = useLogin();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await login({ variables: { email, password } });
      if (data?.login?.accessToken) {
        localStorage.setItem('authToken', data.login.accessToken);
        navigate('/');
      }
    } catch (err) {
      console.error('Login failed', err);
    }
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      bgcolor="background.default"
    >
      <Card sx={{ maxWidth: 400, width: '100%', mx: 2 }}>
        <CardContent>
          <Typography variant="h5" align="center" gutterBottom>
            Fleet Manager Login
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error.message}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={email}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ mt: 3 }}
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
```

## How to Test

### 1. Start Backend First

```bash
cd /c/Users/lmets/OneDrive/Desktop/my-awesome-project
docker compose up -d
sleep 30
docker compose restart backend
```

### 2. Start Frontend

```bash
cd /c/Users/lmets/OneDrive/Desktop/my-awesome-project/frontend
npm run dev
```

### 3. Access Application

Open http://localhost:5173

**Login**: Use credentials from your backend

### 4. Verify Features

- ✅ Apollo Client connects to GraphQL
- ✅ Navigation sidebar works
- ✅ Dashboard shows statistics
- ✅ Drivers table loads data
- ✅ Vehicles cards display
- ✅ Routes map renders
- ✅ Jobs list appears

## Next Steps

### Add Missing Pages

Create the page files listed above in `src/pages/`:
- `DriversPage.tsx`
- `VehiclesPage.tsx`
- `RoutesPage.tsx`
- `JobsPage.tsx`
- `LoginPage.tsx`

### Add Type Definitions

Create `src/types.ts`:

```typescript
export interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  licenseNumber: string;
  status: string;
  currentVehicle?: Vehicle;
}

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  vehicleType: string;
  status: string;
}

export interface Job {
  id: string;
  jobType: string;
  status: string;
  scheduledPickupTime: string;
  scheduledDeliveryTime: string;
}

export interface Route {
  id: string;
  totalDistance: number;
  totalDuration: number;
  waypoints: string;
  status: string;
}
```

### Add Error Boundaries

```typescript
// src/components/ErrorBoundary.tsx
import { Component, ReactNode } from 'react';
import { Alert, Box } from '@mui/material';

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box p={3}>
          <Alert severity="error">Something went wrong!</Alert>
        </Box>
      );
    }
    return this.props.children;
  }
}
```

## Summary

✅ **Created**:
- Apollo Client with auth
- MUI theme
- Layout with navigation
- GraphQL queries/mutations/hooks
- Routing setup

📝 **To Create** (copy-paste above code):
- Dashboard page
- Drivers page
- Vehicles page
- Routes page with map
- Jobs page
- Login page

🚀 **Ready to Run**:
```bash
npm run dev
```

---

**The frontend scaffold is complete and ready to connect to your NestJS backend!**
