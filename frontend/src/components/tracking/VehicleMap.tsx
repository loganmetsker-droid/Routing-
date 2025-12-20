import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getTrackingSocket } from '../../services/socket';

// Fix Leaflet default icon issue with Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom vehicle icons
const createVehicleIcon = (status: string, _vehicleType: string) => {
  const colors: Record<string, string> = {
    available: '#10b981', // green
    in_route: '#3b82f6', // blue
    maintenance: '#f59e0b', // orange
    off_duty: '#6b7280', // gray
  };

  const color = colors[status] || '#6b7280';

  return L.divIcon({
    className: 'custom-vehicle-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 24 24" width="20" height="20">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

// Types
interface VehicleLocation {
  vehicleId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  timestamp: string;
  vehicleInfo?: {
    licensePlate: string;
    make: string;
    model: string;
    status: string;
    vehicleType: string;
  };
}

interface VehicleLocationsPayload {
  vehicles: VehicleLocation[];
  timestamp: string;
  count: number;
}

// Component to auto-fit bounds when vehicles update
function FitBounds({ vehicles }: { vehicles: VehicleLocation[] }) {
  const map = useMap();

  useEffect(() => {
    if (vehicles.length > 0) {
      const bounds = L.latLngBounds(
        vehicles.map((v) => [v.latitude, v.longitude])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [vehicles, map]);

  return null;
}

export default function VehicleMap() {
  const [vehicles, setVehicles] = useState<VehicleLocation[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const socketRef = useRef<ReturnType<typeof getTrackingSocket> | null>(null);

  useEffect(() => {
    // Get socket instance
    const socket = getTrackingSocket();
    socketRef.current = socket;

    // Handle connection
    socket.on('connect', () => {
      console.log('🚗 Connected to vehicle tracking');
      setIsConnected(true);
      // Subscribe to location updates
      socket.emit('subscribe:locations');
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Disconnected from vehicle tracking');
      setIsConnected(false);
    });

    // Handle vehicle location updates
    socket.on('vehicle:locations', (data: VehicleLocationsPayload) => {
      console.log(`📍 Received ${data.count} vehicle locations`);
      setVehicles(data.vehicles);
      setLastUpdate(data.timestamp);
    });

    // Handle errors
    socket.on('error', (error: any) => {
      console.error('Socket error:', error);
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.off('connect');
        socketRef.current.off('disconnect');
        socketRef.current.off('vehicle:locations');
        socketRef.current.off('error');
      }
    };
  }, []);

  // Default center (San Francisco)
  const defaultCenter: [number, number] = [37.7749, -122.4194];
  const center = vehicles.length > 0
    ? [vehicles[0].latitude, vehicles[0].longitude] as [number, number]
    : defaultCenter;

  return (
    <div className="relative w-full h-full">
      {/* Status Bar */}
      <div className="absolute top-4 left-4 z-[1000] bg-white rounded-lg shadow-lg p-4 min-w-[250px]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900">Live Vehicle Tracking</h3>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Vehicles:</span>
            <span className="font-medium">{vehicles.length}</span>
          </div>
          {lastUpdate && (
            <div className="flex justify-between">
              <span className="text-gray-600">Last Update:</span>
              <span className="font-medium text-xs">
                {new Date(lastUpdate).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs font-medium text-gray-700 mb-2">Status:</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>In Route</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span>Maintenance</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500" />
              <span>Off Duty</span>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Vehicle Markers */}
        {vehicles.map((vehicle) => (
          <Marker
            key={vehicle.vehicleId}
            position={[vehicle.latitude, vehicle.longitude]}
            icon={createVehicleIcon(
              vehicle.vehicleInfo?.status || 'available',
              vehicle.vehicleInfo?.vehicleType || 'van'
            )}
          >
            <Popup>
              <div className="p-2">
                <h4 className="font-semibold text-lg mb-2">
                  {vehicle.vehicleInfo?.make} {vehicle.vehicleInfo?.model}
                </h4>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="font-medium">License:</span>{' '}
                    {vehicle.vehicleInfo?.licensePlate}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span>{' '}
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        vehicle.vehicleInfo?.status === 'in_route'
                          ? 'bg-blue-100 text-blue-800'
                          : vehicle.vehicleInfo?.status === 'available'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {vehicle.vehicleInfo?.status}
                    </span>
                  </div>
                  {vehicle.speed !== undefined && (
                    <div>
                      <span className="font-medium">Speed:</span> {vehicle.speed.toFixed(1)} km/h
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-2">
                    Last update: {new Date(vehicle.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Auto-fit bounds */}
        <FitBounds vehicles={vehicles} />
      </MapContainer>
    </div>
  );
}
