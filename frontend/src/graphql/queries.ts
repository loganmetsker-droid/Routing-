import { gql } from '@apollo/client';

// Driver Queries
export const GET_DRIVERS = gql`
  query GetDrivers {
    drivers {
      id
      firstName
      lastName
      email
      phone
      licenseNumber
      status
      currentVehicle {
        id
        make
        model
        licensePlate
      }
      createdAt
      updatedAt
    }
  }
`;

export const GET_DRIVER = gql`
  query GetDriver($id: ID!) {
    driver(id: $id) {
      id
      firstName
      lastName
      email
      phone
      licenseNumber
      status
      currentVehicle {
        id
        make
        model
        licensePlate
      }
      createdAt
      updatedAt
    }
  }
`;

// Vehicle Queries
export const GET_VEHICLES = gql`
  query GetVehicles {
    vehicles {
      id
      make
      model
      year
      licensePlate
      vin
      vehicleType
      fuelType
      status
      capacityWeightKg
      capacityVolumeM3
      currentLocation
      odometer
      fuelLevel
      lastMaintenanceDate
      nextMaintenanceDate
      createdAt
      updatedAt
    }
  }
`;

export const GET_VEHICLES_BY_TYPE = gql`
  query GetVehiclesByType($type: String!) {
    vehicles(where: { vehicleType: $type }) {
      id
      make
      model
      year
      licensePlate
      vehicleType
      status
      currentLocation
    }
  }
`;

export const GET_VEHICLES_NEEDING_MAINTENANCE = gql`
  query GetVehiclesNeedingMaintenance {
    vehicles(where: { needsMaintenance: true }) {
      id
      make
      model
      licensePlate
      odometer
      lastMaintenanceDate
      nextMaintenanceDate
      status
    }
  }
`;

// Job Queries
export const GET_JOBS = gql`
  query GetJobs {
    jobs {
      id
      jobType
      status
      priority
      pickupLocation
      deliveryLocation
      scheduledPickupTime
      scheduledDeliveryTime
      actualPickupTime
      actualDeliveryTime
      estimatedDuration
      notes
      createdAt
      updatedAt
    }
  }
`;

// Route Queries
export const GET_ROUTES = gql`
  query GetRoutes {
    routes {
      id
      vehicleId
      status
      totalDistance
      totalDuration
      startLocation
      endLocation
      waypoints
      optimizationMetric
      createdAt
      updatedAt
    }
  }
`;

export const GET_ROUTE = gql`
  query GetRoute($id: ID!) {
    route(id: $id) {
      id
      vehicleId
      status
      totalDistance
      totalDuration
      startLocation
      endLocation
      waypoints
      optimizationMetric
      routeData
      createdAt
      updatedAt
    }
  }
`;
