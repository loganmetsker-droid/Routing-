import { gql } from '@apollo/client';

// Customer Mutations
export const CREATE_CUSTOMER = gql`
  mutation CreateCustomer($input: CreateCustomerInput!) {
    createCustomer(createCustomerInput: $input) {
      id
      name
      address
      businessName
      notes
      exceptions
    }
  }
`;

export const UPDATE_CUSTOMER = gql`
  mutation UpdateCustomer($id: ID!, $input: UpdateCustomerInput!) {
    updateCustomer(id: $id, updateCustomerInput: $input) {
      id
      name
      address
      businessName
      notes
      exceptions
    }
  }
`;

export const DELETE_CUSTOMER = gql`
  mutation DeleteCustomer($id: ID!) {
    deleteCustomer(id: $id) {
      id
    }
  }
`;

// Driver Mutations
export const CREATE_DRIVER = gql`
  mutation CreateDriver($input: CreateDriverInput!) {
    createDriver(createDriverInput: $input) {
      id
      firstName
      lastName
      email
      phone
      licenseNumber
      status
    }
  }
`;

export const UPDATE_DRIVER = gql`
  mutation UpdateDriver($id: ID!, $input: UpdateDriverInput!) {
    updateDriver(id: $id, updateDriverInput: $input) {
      id
      firstName
      lastName
      email
      phone
      status
    }
  }
`;

// Vehicle Mutations
export const CREATE_VEHICLE = gql`
  mutation CreateVehicle($input: CreateVehicleInput!) {
    createVehicle(createVehicleInput: $input) {
      id
      make
      model
      year
      licensePlate
      vehicleType
      status
    }
  }
`;

export const UPDATE_VEHICLE = gql`
  mutation UpdateVehicle($id: ID!, $input: UpdateVehicleInput!) {
    updateVehicle(id: $id, updateVehicleInput: $input) {
      id
      make
      model
      status
      currentLocation
    }
  }
`;

// Job Mutations
export const CREATE_JOB = gql`
  mutation CreateJob($input: CreateJobInput!) {
    createJob(createJobInput: $input) {
      id
      jobType
      status
      priority
      pickupLocation
      deliveryLocation
      scheduledPickupTime
      scheduledDeliveryTime
    }
  }
`;

export const UPDATE_JOB = gql`
  mutation UpdateJob($id: ID!, $input: UpdateJobInput!) {
    updateJob(id: $id, updateJobInput: $input) {
      id
      status
      actualPickupTime
      actualDeliveryTime
    }
  }
`;

// Route Mutations
export const CREATE_ROUTE = gql`
  mutation CreateRoute($input: CreateRouteInput!) {
    createRoute(createRouteInput: $input) {
      id
      vehicleId
      totalDistance
      totalDuration
      waypoints
      status
    }
  }
`;

// Auth Mutations
export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      accessToken
      user {
        id
        email
        firstName
        lastName
      }
    }
  }
`;
