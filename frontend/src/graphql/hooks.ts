import { useQuery, useMutation } from '@apollo/client';
import {
  GET_DRIVERS,
  GET_DRIVER,
  GET_VEHICLES,
  GET_VEHICLES_BY_TYPE,
  GET_VEHICLES_NEEDING_MAINTENANCE,
  GET_JOBS,
  GET_ROUTES,
  GET_ROUTE,
} from './queries';
import {
  CREATE_DRIVER,
  UPDATE_DRIVER,
  CREATE_VEHICLE,
  UPDATE_VEHICLE,
  CREATE_JOB,
  UPDATE_JOB,
  CREATE_ROUTE,
  LOGIN,
} from './mutations';

// Driver Hooks
export const useDrivers = () => {
  return useQuery(GET_DRIVERS);
};

export const useDriver = (id: string) => {
  return useQuery(GET_DRIVER, {
    variables: { id },
    skip: !id,
  });
};

export const useCreateDriver = () => {
  return useMutation(CREATE_DRIVER, {
    refetchQueries: [{ query: GET_DRIVERS }],
  });
};

export const useUpdateDriver = () => {
  return useMutation(UPDATE_DRIVER, {
    refetchQueries: [{ query: GET_DRIVERS }],
  });
};

// Vehicle Hooks
export const useVehicles = () => {
  return useQuery(GET_VEHICLES);
};

export const useVehiclesByType = (type: string) => {
  return useQuery(GET_VEHICLES_BY_TYPE, {
    variables: { type },
    skip: !type,
  });
};

export const useVehiclesNeedingMaintenance = () => {
  return useQuery(GET_VEHICLES_NEEDING_MAINTENANCE);
};

export const useCreateVehicle = () => {
  return useMutation(CREATE_VEHICLE, {
    refetchQueries: [
      { query: GET_VEHICLES },
      { query: GET_VEHICLES_BY_TYPE, variables: { type: 'truck' } },
      { query: GET_VEHICLES_BY_TYPE, variables: { type: 'van' } },
      { query: GET_VEHICLES_BY_TYPE, variables: { type: 'car' } },
      { query: GET_VEHICLES_NEEDING_MAINTENANCE },
    ],
  });
};

export const useUpdateVehicle = () => {
  return useMutation(UPDATE_VEHICLE, {
    refetchQueries: [
      { query: GET_VEHICLES },
      { query: GET_VEHICLES_BY_TYPE, variables: { type: 'truck' } },
      { query: GET_VEHICLES_BY_TYPE, variables: { type: 'van' } },
      { query: GET_VEHICLES_BY_TYPE, variables: { type: 'car' } },
      { query: GET_VEHICLES_NEEDING_MAINTENANCE },
    ],
  });
};

// Job Hooks
export const useJobs = () => {
  return useQuery(GET_JOBS);
};

export const useCreateJob = () => {
  return useMutation(CREATE_JOB, {
    refetchQueries: [{ query: GET_JOBS }],
  });
};

export const useUpdateJob = () => {
  return useMutation(UPDATE_JOB, {
    refetchQueries: [{ query: GET_JOBS }],
  });
};

// Route Hooks
export const useRoutes = () => {
  return useQuery(GET_ROUTES);
};

export const useRoute = (id: string) => {
  return useQuery(GET_ROUTE, {
    variables: { id },
    skip: !id,
  });
};

export const useCreateRoute = () => {
  return useMutation(CREATE_ROUTE, {
    refetchQueries: [{ query: GET_ROUTES }],
  });
};

// Auth Hooks
export const useLogin = () => {
  return useMutation(LOGIN);
};
