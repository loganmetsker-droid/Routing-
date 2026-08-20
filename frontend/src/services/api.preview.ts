import type {
  DispatchDriver,
  DispatchJob,
  DispatchVehicle,
} from '../types/dispatch';
import { getTrovanDataMode, usesPreviewDataMode } from './dataMode';
import type {
  DispatchTimelineEvent,
  JsonRecord,
  OptimizerHealth,
  PreviewState,
  RouteRecord,
  RouteStopRecord,
  RouteVersion,
  RouteVersionStatus,
  RerouteRequest,
  TrackingLocationsSnapshot,
  TrackingVehicleHistory,
  TrackingVehicleLocation,
} from './api.types';
import { clonePreview, isRecord } from './api.types';

const PREVIEW_BASE_DATE = '2026-04-10';

function shiftPreviewDatesToToday<T>(value: T): T {
  const currentServiceDate = new Date().toISOString().slice(0, 10);
  return JSON.parse(
    JSON.stringify(value).split(PREVIEW_BASE_DATE).join(currentServiceDate),
  ) as T;
}

const buildDensePreviewDemandJobs = (): DispatchJob[] => {
  const clusters = [
    {
      key: 'northwest',
      prefix: 'Northwest Market',
      street: 'W 38th Ave',
      zip: '80211',
      pickupAddress: 'Northwest Cross Dock',
      pickupLocation: { lat: 39.7620, lng: -105.0180 },
      center: { lat: 39.7750, lng: -105.0300 },
      latStep: 0.0062,
      lngStep: -0.0046,
      latWave: 0.0050,
      lngWave: 0.0042,
      count: 7,
    },
    {
      key: 'industrial',
      prefix: 'Industrial Parts',
      street: 'Washington St',
      zip: '80216',
      pickupAddress: 'North Industrial Hub',
      pickupLocation: { lat: 39.8060, lng: -104.9900 },
      center: { lat: 39.7940, lng: -104.9700 },
      latStep: -0.0052,
      lngStep: 0.0058,
      latWave: 0.0050,
      lngWave: 0.0048,
      count: 8,
    },
    {
      key: 'east',
      prefix: 'Eastside Clinic',
      street: 'E Colfax Ave',
      zip: '80220',
      pickupAddress: 'Medical Fulfillment Hub',
      pickupLocation: { lat: 39.7480, lng: -104.9400 },
      center: { lat: 39.7420, lng: -104.9150 },
      latStep: -0.0040,
      lngStep: 0.0068,
      latWave: -0.0050,
      lngWave: 0.0050,
      count: 8,
    },
    {
      key: 'south',
      prefix: 'Southline Foods',
      street: 'S Broadway',
      zip: '80210',
      pickupAddress: 'South Denver Depot',
      pickupLocation: { lat: 39.7080, lng: -104.9970 },
      center: { lat: 39.6900, lng: -104.9950 },
      latStep: -0.0060,
      lngStep: 0.0054,
      latWave: 0.0052,
      lngWave: -0.0050,
      count: 7,
    },
    {
      key: 'southeast',
      prefix: 'Southeast Supply',
      street: 'S Havana St',
      zip: '80231',
      pickupAddress: 'Southeast Staging',
      pickupLocation: { lat: 39.7000, lng: -104.9450 },
      center: { lat: 39.6940, lng: -104.9250 },
      latStep: -0.0044,
      lngStep: 0.0070,
      latWave: -0.0048,
      lngWave: 0.0052,
      count: 8,
    },
  ] as const;

  return clusters.flatMap((cluster, clusterIndex) =>
    Array.from({ length: cluster.count }, (_, stopIndex) => {
      const globalIndex = clusters
        .slice(0, clusterIndex)
        .reduce((sum, item) => sum + item.count, 0) + stopIndex + 17;
      const totalSteps = Math.max(cluster.count - 1, 1);
      const offset = stopIndex - totalSteps / 2;
      const progress = stopIndex / totalSteps;
      const lat =
        cluster.center.lat +
        offset * cluster.latStep +
        Math.sin(progress * Math.PI) * cluster.latWave;
      const lng =
        cluster.center.lng +
        offset * cluster.lngStep +
        Math.cos(progress * Math.PI * 1.5) * cluster.lngWave;
      const priority = stopIndex % 9 === 0 ? 'urgent' : stopIndex % 4 === 0 ? 'high' : 'normal';

      return {
        id: `job-${cluster.key}-${stopIndex + 1}`,
        customerName: `${cluster.prefix} ${String(stopIndex + 1).padStart(2, '0')}`,
        deliveryAddress: `${1200 + globalIndex * 11} ${cluster.street}, Denver, CO ${cluster.zip}`,
        pickupAddress: cluster.pickupAddress,
        pickupLocation: cluster.pickupLocation,
        deliveryLocation: {
          lat: Number(lat.toFixed(5)),
          lng: Number(lng.toFixed(5)),
        },
        status: 'pending',
        priority,
        assignedRouteId: null,
        createdAt: `2026-04-10T10:${String(Math.min(globalIndex, 58)).padStart(2, '0')}:00.000Z`,
      };
    }),
  );
};

const PREVIEW_STATE_SEED: PreviewState = shiftPreviewDatesToToday({
  jobs: clonePreview<DispatchJob[]>([
    {
      id: 'job-jane-1',
      customerId: 'CUST-ROUTE-1001',
      customerName: 'Jane & Sons Bakery',
      deliveryAddress: '1425 Market Ave, Denver, CO 80202',
      pickupAddress: 'Bakery Loading Dock',
      pickupLocation: { lat: 39.7489, lng: -105.0063 },
      deliveryLocation: { lat: 39.7508, lng: -105.0022 },
      status: 'pending',
      priority: 'high',
      assignedRouteId: 'route-alpha-001',
      weight: 816.47,
      volume: 5.35,
      quantity: 4,
      routingRequirements: {
        load: {
          fragile: true,
          stackable: false,
          palletGroups: [{
            id: 'glass-display-pallets',
            label: 'Glass display cases',
            quantity: 4,
            lengthIn: 48,
            widthIn: 40,
            heightIn: 58,
            weightLb: 450,
            stackable: false,
            fragile: true,
            rotationAllowed: false,
          }],
        },
        requiredEquipment: ['liftgate'],
        sequence: { position: 'first', strict: true },
        site: {
          accessCode: '4827',
          accessCodeRequired: true,
          gateInstructions: 'Use the service lane, enter the code at the black keypad, then call receiving.',
        },
        handlingRequirement: 'Do not stack. Glass faces must remain upright and strapped.',
      },
      createdAt: '2026-04-10T08:30:00.000Z',
    },
    {
      id: 'job-omega-2',
      customerId: 'CUST-ROUTE-1002',
      customerName: 'Omega Medical',
      deliveryAddress: '2100 Santa Fe Dr, Denver, CO 80204',
      pickupAddress: 'Medical Fulfillment Hub',
      pickupLocation: { lat: 39.7449, lng: -105.0126 },
      deliveryLocation: { lat: 39.7523, lng: -104.9892 },
      status: 'pending',
      priority: 'urgent',
      assignedRouteId: 'route-alpha-001',
      weight: 544.31,
      volume: 3.4,
      quantity: 3,
      routingRequirements: {
        load: {
          palletGroups: [{
            id: 'medical-cold-chain',
            label: 'Cold-chain medical freight',
            quantity: 3,
            lengthIn: 48,
            widthIn: 40,
            heightIn: 48,
            weightLb: 400,
            stackable: true,
            maxStackLevels: 2,
            compatibilityTags: ['medical'],
            incompatibleWithTags: ['food'],
          }],
        },
        requiredEquipment: ['refrigerated'],
        driver: { requiredCertifications: ['cold_chain'] },
        temperatureRequirement: 'Maintain 36–46°F during transport.',
      },
      createdAt: '2026-04-10T08:45:00.000Z',
    },
    {
      id: 'job-pioneer-3',
      customerId: 'CUST-ROUTE-1003',
      customerName: 'Pioneer Logistics',
      deliveryAddress: '3300 Peña Blvd, Denver, CO 80216',
      pickupAddress: 'Distribution Center',
      pickupLocation: { lat: 39.7898, lng: -104.9725 },
      deliveryLocation: { lat: 39.7333, lng: -104.9875 },
      status: 'pending',
      priority: 'normal',
      assignedRouteId: 'route-beta-002',
      createdAt: '2026-04-10T09:00:00.000Z',
    },
    {
      id: 'job-ridge-4',
      customerId: 'CUST-ROUTE-1004',
      customerName: 'Ridgewood Labs',
      deliveryAddress: '4100 Irving St, Denver, CO 80217',
      pickupAddress: 'Regional Depot',
      pickupLocation: { lat: 39.7625, lng: -105.0214 },
      deliveryLocation: { lat: 39.7491, lng: -105.0011 },
      status: 'pending',
      priority: 'normal',
      assignedRouteId: 'route-gamma-003',
      createdAt: '2026-04-10T09:15:00.000Z',
    },
    {
      id: 'job-river-5',
      customerId: 'CUST-ROUTE-1005',
      customerName: 'Riverfront Catering',
      deliveryAddress: '870 W Evans Ave, Denver, CO 80223',
      pickupAddress: 'Kitchen Hub',
      pickupLocation: { lat: 39.7061, lng: -105.0015 },
      deliveryLocation: { lat: 39.6788, lng: -104.9981 },
      status: 'pending',
      priority: 'low',
      assignedRouteId: null,
      createdAt: '2026-04-10T09:20:00.000Z',
    },
    {
      id: 'job-route-6',
      customerId: 'CUST-ROUTE-1006',
      customerName: 'Aurora Office Supply',
      deliveryAddress: '12100 E Iliff Ave, Aurora, CO 80014',
      pickupAddress: 'Southeast Staging',
      pickupLocation: { lat: 39.7, lng: -104.945 },
      deliveryLocation: { lat: 39.676, lng: -104.885 },
      status: 'pending',
      priority: 'low',
      assignedRouteId: null,
      createdAt: '2026-04-10T09:25:00.000Z',
    },
    {
      id: 'job-highland-7',
      customerId: 'CUST-ROUTE-1007',
      customerName: 'Arvada Grocer',
      deliveryAddress: '7600 W 57th Ave, Arvada, CO 80002',
      pickupAddress: 'Northwest Cross Dock',
      pickupLocation: { lat: 39.762, lng: -105.018 },
      deliveryLocation: { lat: 39.794, lng: -105.052 },
      status: 'pending',
      priority: 'normal',
      assignedRouteId: null,
      createdAt: '2026-04-10T09:30:00.000Z',
    },
    {
      id: 'job-sloan-8',
      customerId: 'CUST-ROUTE-1008',
      customerName: 'Wheat Ridge Pharmacy',
      deliveryAddress: '4990 Kipling St, Wheat Ridge, CO 80033',
      pickupAddress: 'Northwest Cross Dock',
      pickupLocation: { lat: 39.762, lng: -105.018 },
      deliveryLocation: { lat: 39.772, lng: -105.060 },
      status: 'pending',
      priority: 'high',
      assignedRouteId: null,
      createdAt: '2026-04-10T09:35:00.000Z',
    },
    {
      id: 'job-cherry-9',
      customerName: 'Aurora Cold Storage',
      deliveryAddress: '14600 E Alameda Ave, Aurora, CO 80012',
      pickupAddress: 'Eastside Cold Chain Dock',
      pickupLocation: { lat: 39.748, lng: -104.94 },
      deliveryLocation: { lat: 39.724, lng: -104.885 },
      status: 'pending',
      priority: 'urgent',
      assignedRouteId: null,
      createdAt: '2026-04-10T09:40:00.000Z',
    },
    {
      id: 'job-civic-10',
      customerName: 'Havana Market Foods',
      deliveryAddress: '10450 E Mississippi Ave, Aurora, CO 80247',
      pickupAddress: 'Southeast Staging',
      pickupLocation: { lat: 39.7, lng: -104.945 },
      deliveryLocation: { lat: 39.704, lng: -104.892 },
      status: 'pending',
      priority: 'normal',
      assignedRouteId: null,
      createdAt: '2026-04-10T09:45:00.000Z',
    },
    {
      id: 'job-parkhill-11',
      customerName: 'Park Hill Clinic',
      deliveryAddress: '9800 E Colfax Ave, Aurora, CO 80010',
      pickupAddress: 'Medical Fulfillment Hub',
      pickupLocation: { lat: 39.748, lng: -104.94 },
      deliveryLocation: { lat: 39.754, lng: -104.896 },
      status: 'pending',
      priority: 'high',
      assignedRouteId: null,
      createdAt: '2026-04-10T09:50:00.000Z',
    },
    {
      id: 'job-washpark-12',
      customerName: 'Wash Park Market',
      deliveryAddress: '1090 S Downing St, Denver, CO 80210',
      pickupAddress: 'South Denver Depot',
      pickupLocation: { lat: 39.7061, lng: -105.0015 },
      deliveryLocation: { lat: 39.6956, lng: -104.9735 },
      status: 'pending',
      priority: 'normal',
      assignedRouteId: null,
      createdAt: '2026-04-10T09:55:00.000Z',
    },
    {
      id: 'job-globeville-13',
      customerName: 'Globeville Wholesale',
      deliveryAddress: '4800 Washington St, Denver, CO 80216',
      pickupAddress: 'North Industrial Hub',
      pickupLocation: { lat: 39.806, lng: -104.99 },
      deliveryLocation: { lat: 39.812, lng: -104.935 },
      status: 'pending',
      priority: 'normal',
      assignedRouteId: null,
      createdAt: '2026-04-10T10:00:00.000Z',
    },
    {
      id: 'job-auraria-14',
      customerName: 'Southwest Campus Supply',
      deliveryAddress: '5900 S Santa Fe Dr, Littleton, CO 80120',
      pickupAddress: 'South Denver Depot',
      pickupLocation: { lat: 39.708, lng: -104.997 },
      deliveryLocation: { lat: 39.662, lng: -105.018 },
      status: 'pending',
      priority: 'low',
      assignedRouteId: null,
      createdAt: '2026-04-10T10:05:00.000Z',
    },
    {
      id: 'job-sunnyside-15',
      customerName: 'Lakeside Floral',
      deliveryAddress: '5801 W 44th Ave, Denver, CO 80212',
      pickupAddress: 'Northwest Cross Dock',
      pickupLocation: { lat: 39.762, lng: -105.018 },
      deliveryLocation: { lat: 39.758, lng: -105.052 },
      status: 'pending',
      priority: 'normal',
      assignedRouteId: null,
      createdAt: '2026-04-10T10:10:00.000Z',
    },
    {
      id: 'job-central-pack-16',
      customerName: 'Commerce City Packaging',
      deliveryAddress: '5600 E 60th Ave, Commerce City, CO 80022',
      pickupAddress: 'North Industrial Hub',
      pickupLocation: { lat: 39.806, lng: -104.99 },
      deliveryLocation: { lat: 39.818, lng: -104.918 },
      status: 'pending',
      priority: 'low',
      assignedRouteId: null,
      createdAt: '2026-04-10T10:15:00.000Z',
    },
    ...buildDensePreviewDemandJobs(),
  ]),
  routes: clonePreview<RouteRecord[]>([
    {
      id: 'route-alpha-001',
      vehicleId: 'veh-van-1',
      driverId: null,
      status: 'planned',
      totalDistanceKm: 14.7,
      totalDurationMinutes: 35,
      jobIds: ['job-jane-1', 'job-omega-2'],
      workflowStatus: 'planned',
      dataQuality: 'degraded',
      optimizationStatus: 'optimized',
      optimizedStops: [
        {
          jobId: 'job-jane-1',
          sequence: 1,
          address: '1425 Market Ave, Denver, CO 80202',
          location: {
            latitude: 39.7508,
            longitude: -105.0022,
          },
        },
        {
          jobId: 'job-omega-2',
          sequence: 2,
          address: '2100 Santa Fe Dr, Denver, CO 80204',
          location: {
            latitude: 39.7523,
            longitude: -104.9892,
          },
        },
      ],
      routeData: {
        polyline: {
          coordinates: [
            [-105.0022, 39.7508],
            [-105.0056, 39.7497],
            [-104.9892, 39.7523],
          ],
        },
      },
      planningWarnings: ['Capacity review required before dispatch'],
      droppedJobIds: [],
      estimatedCapacity: 1400,
      optimizedAt: '2026-04-10T10:00:00.000Z',
      createdAt: '2026-04-10T09:50:00.000Z',
    },
    {
      id: 'route-beta-002',
      vehicleId: 'veh-van-2',
      driverId: 'driver-anna-2',
      status: 'assigned',
      totalDistanceKm: 9.8,
      totalDurationMinutes: 22,
      jobIds: ['job-pioneer-3'],
      workflowStatus: 'ready_for_dispatch',
      dataQuality: 'live',
      optimizationStatus: 'optimized',
      optimizedStops: [
        {
          jobId: 'job-pioneer-3',
          sequence: 1,
          address: '3300 Peña Blvd, Denver, CO 80216',
          location: {
            latitude: 39.7333,
            longitude: -104.9875,
          },
        },
      ],
      routeData: {
        route: [
          {
            job_id: 'job-pioneer-3',
            sequence: 1,
            address: '3300 Peña Blvd, Denver, CO 80216',
            latitude: 39.7333,
            longitude: -104.9875,
          },
        ],
      },
      estimatedCapacity: 1200,
      createdAt: '2026-04-10T09:55:00.000Z',
    },
    {
      id: 'route-gamma-003',
      vehicleId: 'veh-shuttle-3',
      driverId: 'driver-carl-3',
      status: 'in_progress',
      totalDistanceKm: 21.9,
      totalDurationMinutes: 58,
      jobIds: ['job-ridge-4'],
      workflowStatus: 'in_progress',
      dataQuality: 'degraded',
      optimizationStatus: 'degraded',
      optimizedStops: [
        {
          jobId: 'job-ridge-4',
          sequence: 1,
          address: '4100 Irving St, Denver, CO 80217',
          location: {
            latitude: 39.7491,
            longitude: -105.0011,
          },
        },
      ],
      droppedJobIds: ['job-river-5'],
      planningWarnings: ['One job deferred due route capacity'],
      estimatedCapacity: 1800,
      createdAt: '2026-04-10T08:40:00.000Z',
      dispatchedAt: '2026-04-10T09:10:00.000Z',
    },
  ]),
  drivers: clonePreview<DispatchDriver[]>([
    {
      id: 'driver-anna-2',
      firstName: 'Anna',
      lastName: 'Quinn',
      email: 'anna.quinn@trovan.local',
      phone: '(555) 010-2102',
      licenseNumber: 'CO-CDL-2102',
      licenseType: 'CLASS_B',
      status: 'ACTIVE',
      currentVehicleId: 'veh-van-2',
      assignedVehicleId: 'veh-van-2',
      currentHours: 1.4,
      maxHours: 11,
    },
    {
      id: 'D-1023',
      firstName: 'Sarah',
      lastName: 'Johnson',
      email: 'sarah.johnson@trovan.com',
      phone: '(555) 123-4567',
      licenseNumber: 'TX-CDL-1023',
      licenseType: 'CLASS_A',
      status: 'ACTIVE',
      currentVehicleId: 'veh-van-1',
      assignedVehicleId: 'veh-van-1',
      currentHours: 6.2,
      maxHours: 11,
    },
    { id: 'D-1008', firstName: 'James', lastName: 'Martinez', email: 'james.martinez@trovan.com', phone: '(555) 123-1008', licenseNumber: 'TX-CDL-1008', licenseType: 'CLASS_A', status: 'ACTIVE', currentVehicleId: 'veh-van-2', assignedVehicleId: 'veh-van-2', currentHours: 0, maxHours: 11 },
    { id: 'D-1015', firstName: 'Michael', lastName: 'Chen', email: 'michael.chen@trovan.com', phone: '(555) 123-1015', licenseNumber: 'TX-CDL-1015', licenseType: 'CLASS_B', certifications: ['cold_chain'], status: 'ACTIVE', currentVehicleId: 'veh-shuttle-3', assignedVehicleId: 'veh-shuttle-3', currentHours: 5.7, maxHours: 11 },
    { id: 'D-1003', firstName: 'David', lastName: 'Thompson', email: 'david.thompson@trovan.com', phone: '(555) 123-1003', licenseNumber: 'TX-CDL-1003', licenseType: 'CLASS_A', certifications: ['hazmat', 'cold_chain'], status: 'ACTIVE', currentVehicleId: 'veh-semi-4', assignedVehicleId: 'veh-semi-4', currentHours: 3.4, maxHours: 11 },
    { id: 'D-1018', firstName: 'Lisa', lastName: 'Rodriguez', email: 'lisa.rodriguez@trovan.com', phone: '(555) 123-1018', licenseNumber: 'TX-CDL-1018', licenseType: 'CLASS_A', status: 'ACTIVE', currentVehicleId: 'veh-van-5', assignedVehicleId: 'veh-van-5', currentHours: 4.9, maxHours: 11 },
    { id: 'D-1005', firstName: 'Robert', lastName: 'Williams', email: 'robert.williams@trovan.com', phone: '(555) 123-1005', licenseNumber: 'TX-CDL-1005', licenseType: 'CLASS_B', status: 'OFF_DUTY', currentVehicleId: null, assignedVehicleId: null, currentHours: 0, maxHours: 11 },
    { id: 'D-1021', firstName: 'Emily', lastName: 'Davis', email: 'emily.davis@trovan.com', phone: '(555) 123-1021', licenseNumber: 'TX-CDL-1021', licenseType: 'CLASS_A', status: 'ACTIVE', currentVehicleId: 'veh-van-2', assignedVehicleId: 'veh-van-2', currentHours: 7.1, maxHours: 11 },
    { id: 'D-1007', firstName: 'Daniel', lastName: 'Brown', email: 'daniel.brown@trovan.com', phone: '(555) 123-1007', licenseNumber: 'TX-CDL-1007', licenseType: 'CLASS_A', status: 'ACTIVE', currentVehicleId: 'veh-shuttle-3', assignedVehicleId: 'veh-shuttle-3', currentHours: 9.6, maxHours: 11 },
    { id: 'D-1012', firstName: 'Amanda', lastName: 'Lee', email: 'amanda.lee@trovan.com', phone: '(555) 123-1012', licenseNumber: 'TX-CDL-1012', licenseType: 'CLASS_B', status: 'ACTIVE', currentVehicleId: null, assignedVehicleId: null, currentHours: 0, maxHours: 11 },
    { id: 'D-1011', firstName: 'Kevin', lastName: 'Harris', email: 'kevin.harris@trovan.com', phone: '(555) 123-1011', licenseNumber: 'TX-CDL-1011', licenseType: 'CLASS_A', status: 'OFF_DUTY', currentVehicleId: null, assignedVehicleId: null, currentHours: 0, maxHours: 11 },
  ]),
  vehicles: clonePreview<DispatchVehicle[]>([
    {
      id: 'veh-van-1',
      make: 'Ford',
      model: 'Transit',
      licensePlate: 'DEN-112',
      vehicleType: 'cargo_van',
      status: 'available',
      capacity: 1500,
      capacityWeightKg: 1587.57,
      capacityVolumeM3: 7.36,
      routingProfile: {
        cargo: { interiorLengthIn: 126, interiorWidthIn: 70, interiorHeightIn: 72, doorHeightIn: 68, maxPalletPositions: 3, maxPalletWeightLb: 1200, maxStackLevels: 1 },
        features: ['side door'],
        handlingCapabilities: ['parcel'],
        blockedDriverIds: ['D-1008'],
        operatingRules: [{ id: 'van-1-height', label: 'Low-clearance routes only', instruction: 'Do not assign to mountain roads requiring more than 9 ft clearance.', severity: 'warning', active: true }],
      },
      currentLocation: { lat: 39.762, lng: -105.018 },
    },
    {
      id: 'veh-van-2',
      make: 'Chevy',
      model: 'Express',
      licensePlate: 'DEN-220',
      vehicleType: 'box_truck',
      status: 'available',
      capacity: 1200,
      capacityWeightKg: 4535.92,
      capacityVolumeM3: 25.49,
      routingProfile: {
        cargo: { interiorLengthIn: 192, interiorWidthIn: 90, interiorHeightIn: 90, doorHeightIn: 84, maxPalletPositions: 8, maxPalletWeightLb: 2200, maxStackLevels: 2, maxStackHeightIn: 84 },
        features: ['liftgate', 'pallet jack'],
        handlingCapabilities: ['fragile'],
        operatingRules: [{ id: 'box-2-glass', label: 'Glass securement', instruction: 'Use E-track straps and corner protectors for glass freight.', severity: 'hard', active: true }],
      },
      currentLocation: { lat: 39.806, lng: -104.99 },
    },
    {
      id: 'veh-shuttle-3',
      make: 'Mercedes',
      model: 'Sprinter',
      licensePlate: 'DEN-331',
      vehicleType: 'sprinter_van',
      status: 'in_use',
      capacity: 1800,
      capacityWeightKg: 1905.09,
      capacityVolumeM3: 11.89,
      routingProfile: {
        cargo: { interiorLengthIn: 168, interiorWidthIn: 70, interiorHeightIn: 75, doorHeightIn: 72, maxPalletPositions: 4, maxPalletWeightLb: 1400, maxStackLevels: 2 },
        features: ['liftgate'],
        handlingCapabilities: ['refrigerated', 'medical'],
        allowedDriverIds: ['D-1015', 'D-1003'],
      },
      currentLocation: { lat: 39.748, lng: -104.94 },
    },
    {
      id: 'veh-semi-4',
      make: 'Freightliner',
      model: 'Cascadia',
      licensePlate: 'DEN-808',
      vehicleType: 'semi_truck',
      status: 'available',
      capacity: 18000,
      capacityWeightKg: 20411.66,
      capacityVolumeM3: 98.97,
      routingProfile: {
        cargo: { interiorLengthIn: 636, interiorWidthIn: 100, interiorHeightIn: 110, doorHeightIn: 108, maxPalletPositions: 26, maxPalletWeightLb: 3000, maxStackLevels: 2, maxStackHeightIn: 106 },
        features: ['dock height', 'pallet jack'],
        handlingCapabilities: ['hazmat', 'refrigerated', 'medical'],
      },
      currentLocation: { lat: 39.708, lng: -104.997 },
    },
    {
      id: 'veh-box-5',
      make: 'Isuzu',
      model: 'NPR',
      licensePlate: 'DEN-544',
      vehicleType: 'box_truck',
      status: 'available',
      capacity: 5200,
      capacityWeightKg: 5216.31,
      capacityVolumeM3: 28.32,
      routingProfile: {
        cargo: { interiorLengthIn: 216, interiorWidthIn: 92, interiorHeightIn: 91, doorHeightIn: 85, maxPalletPositions: 10, maxPalletWeightLb: 2400, maxStackLevels: 2 },
        features: ['liftgate', 'pallet jack'],
        handlingCapabilities: ['fragile'],
      },
      currentLocation: { lat: 39.7, lng: -104.945 },
    },
  ]),
  optimizerHealth: {
    status: 'healthy',
    circuitOpen: false,
    consecutiveFailures: 0,
    lastCheckedAt: '2026-04-10T10:09:00.000Z',
    message: 'Simulation mode active (local preview seed).',
  } as OptimizerHealth,
  timeline: clonePreview<DispatchTimelineEvent[]>([
    {
      id: 'timeline-1',
      source: 'system',
      level: 'info',
      code: 'PREVIEW_INIT',
      message: 'Local dispatch board preview seed loaded.',
      action: 'seed_loaded',
      createdAt: '2026-04-10T10:00:00.000Z',
    },
    {
      id: 'timeline-2',
      source: 'workflow',
      level: 'info',
      code: 'PLAN_READY',
      message: 'Route alpha planned with 2 jobs.',
      routeId: 'route-alpha-001',
      action: 'route_planned',
      createdAt: '2026-04-10T10:02:00.000Z',
    },
    {
      id: 'timeline-3',
      source: 'workflow',
      level: 'warning',
      code: 'DEGRADED',
      message: 'Route gamma contains degraded optimization warning.',
      routeId: 'route-gamma-003',
      action: 'optimization_warning',
      createdAt: '2026-04-10T10:05:00.000Z',
    },
  ]),
  routeVersions: {
    'route-alpha-001': clonePreview<RouteVersion[]>([
      {
        id: 'alpha-v1',
        routeId: 'route-alpha-001',
        versionNumber: 1,
        status: 'DRAFT',
        snapshot: { note: 'Initial draft generated from seeded planner data.' },
        createdByUserId: 'preview-user',
        createdAt: '2026-04-10T09:57:00.000Z',
      },
      {
        id: 'alpha-v2',
        routeId: 'route-alpha-001',
        versionNumber: 2,
        status: 'REVIEWED',
        snapshot: { note: 'Reviewed by ops lead.' },
        reviewedByUserId: 'preview-user',
        reviewedAt: '2026-04-10T10:03:00.000Z',
        createdByUserId: 'preview-user',
        createdAt: '2026-04-10T10:02:00.000Z',
      },
    ]),
    'route-beta-002': clonePreview<RouteVersion[]>([
      {
        id: 'beta-v1',
        routeId: 'route-beta-002',
        versionNumber: 1,
        status: 'DRAFT',
        snapshot: { note: 'Live assignment seeded for inspection.' },
        createdByUserId: 'preview-user',
        createdAt: '2026-04-10T09:58:00.000Z',
      },
    ]),
    'route-gamma-003': clonePreview<RouteVersion[]>([
      {
        id: 'gamma-v1',
        routeId: 'route-gamma-003',
        versionNumber: 1,
        status: 'APPROVED',
        snapshot: { note: 'Approved for execution from preview seed.' },
        createdByUserId: 'preview-user',
        approvedByUserId: 'preview-user',
        reviewedByUserId: 'preview-user',
        reviewedAt: '2026-04-10T09:40:00.000Z',
        approvedAt: '2026-04-10T09:42:00.000Z',
        createdAt: '2026-04-10T09:35:00.000Z',
      },
    ]),
  },
  rerouteHistory: {
    'route-gamma-003': [
      {
        id: 'reroute-gamma-1',
        routeId: 'route-gamma-003',
        exceptionCategory: 'capacity',
        action: 'defer_job',
        status: 'requested',
        reason: 'Single job deferred to respect route-hours policy',
        requestedAt: '2026-04-10T10:06:00.000Z',
      },
    ],
  },
});

const PREVIEW_STATE_STORAGE_KEY = 'trovan-preview-state-v2';

const readPersistedPreviewState = (): PreviewState | null => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(PREVIEW_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? (parsed as PreviewState) : null;
  } catch {
    return null;
  }
};

export const previewState = clonePreview(
  readPersistedPreviewState() || PREVIEW_STATE_SEED,
);

export const persistPreviewState = () => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      PREVIEW_STATE_STORAGE_KEY,
      JSON.stringify(previewState),
    );
  } catch {
    // Preview persistence is best-effort only.
  }
};

export const isPreview = () => usesPreviewDataMode(getTrovanDataMode());

if (typeof window !== 'undefined' && isPreview() && !readPersistedPreviewState()) {
  persistPreviewState();
}

export const nowIso = () => new Date().toISOString();

const pickPreviewRoute = (routeId: string) =>
  previewState.routes.find((route) => route.id === routeId);

const pickPreviewVersions = (routeId: string): RouteVersion[] =>
  previewState.routeVersions[routeId] ?? [];

const pickPreviewRerouteHistory = (routeId: string) =>
  previewState.rerouteHistory[routeId] ?? [];

const nextVersionNumber = (routeId: string) =>
  pickPreviewVersions(routeId).reduce(
    (max, version) => Math.max(max, version.versionNumber),
    0,
  ) + 1;

export const getPreviewRoute = (routeId: string): RouteRecord => {
  const route = pickPreviewRoute(routeId);
  if (!route) {
    throw new Error(`Route ${routeId} not found`);
  }
  return route;
};

export const getPreviewReroutes = (routeId: string): RerouteRequest[] =>
  pickPreviewRerouteHistory(routeId).slice();

export const ensurePreviewRouteVersions = (routeId: string): RouteVersion[] =>
  (previewState.routeVersions[routeId] ??= []);

export const getPreviewVersionsForRoute = (routeId: string): RouteVersion[] =>
  ensurePreviewRouteVersions(routeId)
    .slice()
    .sort((left, right) => right.versionNumber - left.versionNumber);

export const getPreviewVersionById = (
  routeId: string,
  versionId: string,
): RouteVersion | null => {
  const versions = pickPreviewVersions(routeId);
  return versions.find((version) => version.id === versionId) ?? null;
};

export const toPreviewRouteVersion = (
  routeId: string,
  status: RouteVersionStatus,
  versionNumber = nextVersionNumber(routeId),
): RouteVersion => ({
  id: `${routeId}-v${String(versionNumber).padStart(3, '0')}`,
  routeId,
  versionNumber,
  status,
  snapshot: { note: `Local preview snapshot for ${status.toLowerCase()}` },
  createdByUserId: 'preview-user',
  reviewedByUserId: null,
  approvedByUserId: null,
  publishedByUserId: null,
  createdAt: nowIso(),
});

const routeHasJob = (route: RouteRecord, jobId: string) =>
  Array.isArray(route.jobIds) && route.jobIds.includes(jobId);

const syncAssignedJobsForRoute = (route: RouteRecord, keepStatus = false) => {
  previewState.jobs.forEach((job) => {
    const currentlyAssigned = job.assignedRouteId === route.id;
    const shouldBeAssigned = routeHasJob(route, job.id);
    if (currentlyAssigned && !shouldBeAssigned) {
      job.assignedRouteId = null;
      if (!keepStatus) {
        job.status = job.status || 'pending';
      }
    }
    if (!currentlyAssigned && shouldBeAssigned) {
      job.assignedRouteId = route.id;
      if (!keepStatus) {
        job.status = 'pending';
      }
    }
  });
};

export const updatePreviewRoute = (
  routeId: string,
  update: (route: RouteRecord) => void,
): RouteRecord => {
  const route = getPreviewRoute(routeId);
  update(route);
  syncAssignedJobsForRoute(route);
  return route;
};

export const previewEvent = (
  routeId: string,
  code: string,
  message: string,
  source: DispatchTimelineEvent['source'] = 'workflow',
  extra: Partial<DispatchTimelineEvent> = {},
): DispatchTimelineEvent => ({
  id: `preview-${routeId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  routeId,
  source,
  level: 'info',
  code,
  message,
  createdAt: nowIso(),
  action: code.toLowerCase(),
  ...extra,
});

const toPreviewCoordinate = (
  stop: RouteStopRecord | JsonRecord,
): { latitude: number; longitude: number } | null => {
  const stopRecord = stop as RouteStopRecord & JsonRecord;
  const location = isRecord(stopRecord.location) ? stopRecord.location : null;
  const latitude = Number(
    (location?.latitude ?? stopRecord.latitude ?? stopRecord.lat) as
      | number
      | string
      | undefined,
  );
  const longitude = Number(
    (location?.longitude ?? stopRecord.longitude ?? stopRecord.lng) as
      | number
      | string
      | undefined,
  );

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
};

export const getPreviewTrackingCoordinate = (
  route: RouteRecord,
): { latitude: number; longitude: number } | null => {
  const stop = [...(route.optimizedStops || [])]
    .reverse()
    .find((item) => Boolean(toPreviewCoordinate(item)));
  if (stop) {
    return toPreviewCoordinate(stop);
  }

  const routeData = isRecord(route.routeData) ? route.routeData : {};
  const rawStops = Array.isArray(routeData.route) ? routeData.route : [];
  const rawStop = [...rawStops]
    .reverse()
    .find((item) => isRecord(item) && Boolean(toPreviewCoordinate(item)));
  return isRecord(rawStop) ? toPreviewCoordinate(rawStop) : null;
};

export const buildPreviewTrackingSnapshot = (): TrackingLocationsSnapshot => {
  const vehicles = previewState.routes
    .filter((route) => route.vehicleId)
    .map((route, routeIndex) => {
      const coordinate = getPreviewTrackingCoordinate(route);
      if (!coordinate) {
        return null;
      }

      const vehicle = previewState.vehicles.find((item) => item.id === route.vehicleId);
      return {
        vehicleId: route.vehicleId,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        timestamp: new Date(
          Date.now() - [60_000, 5 * 60_000, 16 * 60_000][routeIndex % 3],
        ).toISOString(),
        vehicleInfo: {
          licensePlate: vehicle?.licensePlate,
          make: vehicle?.make,
          model: vehicle?.model,
          status: vehicle?.status,
        },
      } as TrackingVehicleLocation;
    })
    .filter(
      (item: TrackingVehicleLocation | null): item is TrackingVehicleLocation =>
        Boolean(item),
    );

  return {
    vehicles,
    timestamp: nowIso(),
    count: vehicles.length,
  };
};

export const buildPreviewVehicleTrackingHistory = (
  vehicleId: string,
  hours: number,
): TrackingVehicleHistory => {
  const rangeHours = Math.max(1, Math.min(168, Math.floor(hours) || 24));
  const route = previewState.routes.find((item) => item.vehicleId === vehicleId);
  const vehicle = previewState.vehicles.find((item) => item.id === vehicleId);
  const routeIndex = Math.max(
    previewState.routes.findIndex((item) => item.vehicleId === vehicleId),
    0,
  );
  const routeData = isRecord(route?.routeData) ? route?.routeData : {};
  const polyline = isRecord(routeData.polyline) ? routeData.polyline : {};
  const routePoints = Array.isArray(polyline.coordinates)
    ? polyline.coordinates
        .map((point) => {
          if (!Array.isArray(point) || point.length < 2) return null;
          const longitude = Number(point[0]);
          const latitude = Number(point[1]);
          return Number.isFinite(latitude) && Number.isFinite(longitude)
            ? { latitude, longitude }
            : null;
        })
        .filter(
          (point): point is { latitude: number; longitude: number } =>
            Boolean(point),
        )
    : [];
  const stopPoints = (route?.optimizedStops || [])
    .map((stop) =>
      stop.location
        ? {
            latitude: stop.location.latitude,
            longitude: stop.location.longitude,
          }
        : null,
    )
    .filter(
      (point): point is { latitude: number; longitude: number } => Boolean(point),
    );
  const anchors = [
    vehicle?.currentLocation
      ? {
          latitude: vehicle.currentLocation.lat,
          longitude: vehicle.currentLocation.lng,
        }
      : null,
    ...routePoints,
    ...stopPoints,
  ].filter(
    (point): point is { latitude: number; longitude: number } => Boolean(point),
  );

  const expanded = anchors.flatMap((point, index) => {
    const next = anchors[index + 1];
    if (!next) return [point];
    return Array.from({ length: 4 }, (_, step) => {
      const progress = step / 4;
      return {
        latitude: point.latitude + (next.latitude - point.latitude) * progress,
        longitude: point.longitude + (next.longitude - point.longitude) * progress,
      };
    });
  });
  const newestAtMs =
    Date.now() - [60_000, 5 * 60_000, 16 * 60_000][routeIndex % 3];
  const history = expanded.map((point, index) => ({
    vehicleId,
    latitude: point.latitude,
    longitude: point.longitude,
    speed: 18 + ((index + routeIndex) % 5) * 4,
    heading: (80 + index * 17) % 360,
    timestamp: new Date(
      newestAtMs - (expanded.length - index - 1) * 3 * 60_000,
    ).toISOString(),
    vehicleInfo: {
      licensePlate: vehicle?.licensePlate,
      make: vehicle?.make,
      model: vehicle?.model,
      status: vehicle?.status,
    },
  }));

  return {
    vehicleId,
    rangeHours,
    count: history.length,
    pointLimit: 1000,
    pointLimitReached: false,
    order: 'ascending',
    source: 'preview',
    oldestAt: history[0]?.timestamp,
    newestAt: history.at(-1)?.timestamp,
    history,
  };
};
