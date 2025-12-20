# Routing & Dispatching SaaS Platform

A modern, scalable routing and dispatching platform built with TypeScript, designed for fleet management and logistics operations.

## Tech Stack

### Backend
- **NestJS** - Progressive Node.js framework
- **TypeORM** - Database ORM
- **GraphQL** (Apollo) - Query language for APIs
- **REST API** - Traditional RESTful endpoints
- **Swagger** - API documentation

### Frontend
- **React 18** - UI library
- **Vite** - Next-generation build tool
- **TanStack Query** - Data fetching and caching
- **Apollo Client** - GraphQL client
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **Leaflet** - Interactive maps

### Database
- **PostgreSQL 15** - Relational database
- **TimescaleDB** - Time-series data extension
- **PostGIS** - Geospatial data support

### Infrastructure
- **Docker** - Containerization
- **Kubernetes** - Container orchestration
- **Nginx** - Reverse proxy and static file serving

## Features

- **Driver Management** - Track and manage fleet drivers
- **Vehicle Management** - Monitor vehicle status and capacity
- **Route Optimization** - Plan and optimize delivery routes
- **Dispatch Operations** - Coordinate dispatch assignments
- **Real-time Tracking** - Live GPS tracking with TimescaleDB
- **GraphQL & REST APIs** - Flexible API options
- **Geospatial Queries** - PostGIS-powered location services

## Getting Started

### Prerequisites

- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **Docker** and **Docker Compose**
- **Git**

### Local Development with Docker Compose

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd my-awesome-project
   ```

2. **Set up environment variables**
   ```bash
   # Backend
   cp backend/.env.example backend/.env

   # Frontend
   cp frontend/.env.example frontend/.env
   ```

3. **Start the development environment**
   ```bash
   # Start PostgreSQL/TimescaleDB and Redis
   npm run docker:dev
   ```

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **Run the applications**

   In separate terminals:

   ```bash
   # Terminal 1 - Backend
   cd backend
   npm run dev
   ```

   ```bash
   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

6. **Access the applications**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - API Documentation: http://localhost:3000/api/docs
   - GraphQL Playground: http://localhost:3000/graphql

### Production Deployment with Docker

```bash
# Build and start all services
npm run docker:prod

# Or use docker-compose directly
docker-compose -f infrastructure/docker/docker-compose.yml up -d
```

### Kubernetes Deployment

1. **Create secrets**
   ```bash
   kubectl create secret generic postgres-secret \
     --from-literal=password=YOUR_DB_PASSWORD \
     -n routing-dispatch

   kubectl create secret generic app-secrets \
     --from-literal=jwt-secret=YOUR_JWT_SECRET \
     -n routing-dispatch
   ```

2. **Deploy to Kubernetes**
   ```bash
   npm run k8s:deploy

   # Or use kubectl directly
   kubectl apply -f infrastructure/k8s/
   ```

3. **Verify deployment**
   ```bash
   kubectl get pods -n routing-dispatch
   kubectl get services -n routing-dispatch
   ```

## Project Structure

```
my-awesome-project/
├── backend/                    # NestJS backend application
│   ├── src/
│   │   ├── modules/           # Feature modules
│   │   │   ├── auth/          # Authentication & authorization
│   │   │   ├── drivers/       # Driver management
│   │   │   ├── vehicles/      # Vehicle management
│   │   │   ├── routes/        # Route planning & optimization
│   │   │   ├── dispatches/    # Dispatch operations
│   │   │   └── tracking/      # Real-time GPS tracking
│   │   ├── common/            # Shared utilities
│   │   ├── config/            # Configuration
│   │   ├── database/          # Migrations & seeds
│   │   ├── app.module.ts      # Root module
│   │   └── main.ts            # Application entry point
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                   # React frontend application
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── layout/        # Layout components
│   │   │   ├── drivers/       # Driver components
│   │   │   ├── routes/        # Route components
│   │   │   ├── dispatches/    # Dispatch components
│   │   │   └── tracking/      # Tracking/map components
│   │   ├── pages/             # Page components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── services/          # API services
│   │   ├── utils/             # Utility functions
│   │   ├── types/             # TypeScript types
│   │   ├── styles/            # Global styles
│   │   ├── App.tsx            # Root component
│   │   └── main.tsx           # Application entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── infrastructure/             # Infrastructure as code
│   ├── docker/                # Docker configuration
│   │   ├── Dockerfile.backend
│   │   ├── Dockerfile.frontend
│   │   ├── docker-compose.yml
│   │   ├── docker-compose.dev.yml
│   │   ├── nginx.conf
│   │   └── init-db.sql       # Database initialization
│   └── k8s/                   # Kubernetes manifests
│       ├── namespace.yaml
│       ├── postgres-statefulset.yaml
│       ├── backend-deployment.yaml
│       ├── frontend-deployment.yaml
│       ├── secrets.yaml
│       └── ingress.yaml
│
├── docs/                      # Documentation
├── package.json              # Root package.json (workspaces)
└── README.md
```

## Database Schema

### Core Tables

- **drivers** - Driver information and current status
- **vehicles** - Fleet vehicle details and capacity
- **routes** - Planned routes with waypoints
- **dispatches** - Dispatch assignments and delivery info
- **tracking_events** - Time-series GPS tracking data (TimescaleDB hypertable)

### Key Features

- **PostGIS** for geospatial queries and distance calculations
- **TimescaleDB** for efficient time-series tracking data
- **Automatic retention policies** (90-day default for tracking data)
- **Optimized indexes** for location-based queries

## API Documentation

### REST API

Once the backend is running, visit http://localhost:3000/api/docs for interactive Swagger documentation.

### GraphQL

GraphQL Playground: http://localhost:3000/graphql

Example query:
```graphql
query {
  drivers {
    id
    firstName
    lastName
    status
  }
}
```

## Development

### Run Tests

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

### Database Migrations

```bash
cd backend

# Generate a new migration
npm run migration:generate -- src/database/migrations/MigrationName

# Run migrations
npm run migration:run

# Revert last migration
npm run migration:revert
```

### Code Quality

```bash
# Lint frontend
cd frontend
npm run lint

# Type checking
npm run build  # TypeScript compilation happens during build
```

## Environment Variables

### Backend (.env)

```env
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=routing_dispatch

JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

TIMESCALE_ENABLED=true
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:3000
VITE_GRAPHQL_URL=http://localhost:3000/graphql
VITE_WS_URL=ws://localhost:3000
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License
