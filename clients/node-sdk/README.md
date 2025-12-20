# Routing & Dispatch Node.js SDK

Official Node.js/TypeScript client library for the Routing & Dispatch SaaS API.

## Installation

```bash
npm install @routing-dispatch/sdk
# or
yarn add @routing-dispatch/sdk
```

## Quick Start

```typescript
import { RoutingClient, DispatchClient } from '@routing-dispatch/sdk';

// Initialize clients
const routing = new RoutingClient({ apiKey: 'your-api-key-here' });
const dispatch = new DispatchClient({ apiKey: 'your-api-key-here' });

// Plan a route
const route = await routing.planRoute({
  vehicleId: 'vehicle-123',
  jobIds: ['job-1', 'job-2', 'job-3'],
});

console.log(`Route distance: ${route.totalDistance}km`);
console.log(`Estimated duration: ${route.totalDuration}min`);

// Assign routes to drivers
const result = await dispatch.assignRoutes([
  { routeId: route.id, driverId: 'driver-456' },
]);

console.log(`Dispatch created: ${result.dispatches[0].id}`);
```

## Features

- **Full TypeScript Support**: Complete type definitions for all APIs
- **Route Planning**: Optimize routes for vehicles and jobs
- **Dispatch Management**: Assign routes to drivers
- **Error Handling**: Comprehensive error types
- **Promise-based**: Modern async/await API

## Usage Examples

### Routing Client

```typescript
import { RoutingClient } from '@routing-dispatch/sdk';

const client = new RoutingClient({
  apiKey: 'your-api-key',
  baseURL: 'https://api.routingdispatch.com/api', // Optional
  timeout: 30000, // Optional (milliseconds)
});

// Plan an optimized route
const route = await client.planRoute({
  vehicleId: 'v-123',
  jobIds: ['j-1', 'j-2', 'j-3'],
  optimize: true,
  startLocation: { lat: 40.7128, lng: -74.0060 },
  endLocation: { lat: 40.7580, lng: -73.9855 },
});

// Get route details
const routeDetails = await client.getRoute('route-123');

// List all routes
const routes = await client.listRoutes({
  vehicleId: 'v-123',
  status: 'planned',
  limit: 10,
});

// Calculate distance between points
const distanceData = await client.calculateDistance({
  origin: { lat: 40.7128, lng: -74.0060 },
  destination: { lat: 40.7580, lng: -73.9855 },
  waypoints: [{ lat: 40.7489, lng: -73.9680 }],
});

// Optimize existing route
const optimized = await client.optimizeRoute('route-123');

// Delete a route
await client.deleteRoute('route-123');
```

### Dispatch Client

```typescript
import { DispatchClient } from '@routing-dispatch/sdk';

const client = new DispatchClient({ apiKey: 'your-api-key' });

// Create a dispatch
const dispatch = await client.createDispatch({
  routeId: 'route-123',
  driverId: 'driver-456',
  vehicleId: 'vehicle-789',
  scheduledStart: '2025-01-20T09:00:00Z',
  notes: 'Priority delivery',
});

// List dispatches
const dispatches = await client.listDispatches({
  driverId: 'driver-456',
  status: 'in_progress',
  date: '2025-01-20',
});

// Update dispatch status
const updated = await client.updateDispatchStatus('dispatch-123', {
  status: 'completed',
  notes: 'All deliveries successful',
});

// Get driver schedule
const schedule = await client.getDriverSchedule(
  'driver-456',
  '2025-01-20',
  '2025-01-27'
);

// Cancel a dispatch
const canceled = await client.cancelDispatch('dispatch-123', 'Customer request');
```

## Error Handling

```typescript
import {
  RoutingClient,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  RoutingDispatchError,
} from '@routing-dispatch/sdk';

const client = new RoutingClient({ apiKey: 'your-key' });

try {
  const route = await client.planRoute({
    vehicleId: 'v-123',
    jobIds: ['j-1', 'j-2'],
  });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key');
  } else if (error instanceof ValidationError) {
    console.error('Validation failed:', error.errors);
  } else if (error instanceof NotFoundError) {
    console.error('Resource not found');
  } else if (error instanceof RateLimitError) {
    console.error(`Rate limit exceeded. Retry after ${error.retryAfter}s`);
  } else if (error instanceof RoutingDispatchError) {
    console.error(`API error: ${error.message} (status: ${error.statusCode})`);
  }
}
```

## Configuration

### Environment Variables

```bash
export ROUTING_DISPATCH_API_KEY="your-api-key"
export ROUTING_DISPATCH_BASE_URL="https://api.routingdispatch.com/api"
```

### Using Environment Variables

```typescript
import { RoutingClient } from '@routing-dispatch/sdk';

const client = new RoutingClient({
  apiKey: process.env.ROUTING_DISPATCH_API_KEY!,
  baseURL: process.env.ROUTING_DISPATCH_BASE_URL,
  timeout: 60000, // 60 seconds
});
```

## Type Definitions

All types are fully exported and available for use:

```typescript
import type {
  Route,
  Dispatch,
  Location,
  RouteAssignment,
  PlanRouteOptions,
  ListDispatchesOptions,
} from '@routing-dispatch/sdk';

const location: Location = {
  lat: 40.7128,
  lng: -74.0060,
};

const assignment: RouteAssignment = {
  routeId: 'route-123',
  driverId: 'driver-456',
};
```

## Development

```bash
# Clone repository
git clone https://github.com/your-org/routing-dispatch-sdk-node
cd routing-dispatch-sdk-node

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint

# Format code
npm run format
```

## Requirements

- Node.js >= 16.0.0
- TypeScript >= 5.0.0 (for development)

## License

MIT License - see LICENSE file for details

## Support

- Documentation: https://docs.routingdispatch.com/node-sdk
- Issues: https://github.com/your-org/routing-dispatch-sdk-node/issues
- Email: support@routingdispatch.com
