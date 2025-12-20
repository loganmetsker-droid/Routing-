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
