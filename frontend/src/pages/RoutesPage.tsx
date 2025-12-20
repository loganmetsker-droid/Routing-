import { useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import { Box, Typography, Grid, Card, CardContent, List, ListItem, ListItemButton, ListItemText, CircularProgress } from '@mui/material';
import { useRoutes, useRoute } from '../graphql/hooks';
import 'leaflet/dist/leaflet.css';

export default function RoutesPage() {
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const { data: routesData, loading: routesLoading } = useRoutes();
  const { data: routeData } = useRoute(selectedRouteId || '');

  const routes = routesData?.routes || [];
  const selectedRoute = routeData?.route;

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
                    <ListItem key={route.id} disablePadding>
                      <ListItemButton
                        selected={selectedRouteId === route.id}
                        onClick={() => setSelectedRouteId(route.id)}
                      >
                        <ListItemText
                          primary={route.id}
                          secondary={`Distance: ${route.totalDistance}km`}
                        />
                      </ListItemButton>
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
