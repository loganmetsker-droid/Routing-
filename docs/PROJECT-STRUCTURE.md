# Project Structure - Routing & Dispatching SaaS

This document provides a detailed overview of the project structure and file descriptions.

## Directory Tree

```
my-awesome-project/
├── README.md                          # Main project documentation
├── package.json                       # Root workspace configuration
├── .gitignore                         # Git ignore rules
│
├── backend/                           # NestJS Backend Application
│   ├── src/
│   │   ├── main.ts                   # Application entry point, bootstraps NestJS
│   │   ├── app.module.ts             # Root module, imports all feature modules
│   │   │
│   │   ├── modules/                  # Feature modules (business logic)
│   │   │   ├── auth/
│   │   │   │   └── auth.module.ts   # Authentication & JWT authorization
│   │   │   ├── drivers/
│   │   │   │   ├── driver.entity.ts  # Driver entity (TypeORM model)
│   │   │   │   ├── drivers.module.ts # Driver module definition
│   │   │   │   ├── drivers.service.ts # Driver business logic
│   │   │   │   ├── drivers.controller.ts # REST API endpoints
│   │   │   │   └── drivers.resolver.ts   # GraphQL resolvers
│   │   │   ├── vehicles/
│   │   │   │   └── vehicles.module.ts # Fleet vehicle management
│   │   │   ├── routes/
│   │   │   │   └── routes.module.ts  # Route planning & optimization
│   │   │   ├── dispatches/
│   │   │   │   └── dispatches.module.ts # Dispatch operations
│   │   │   └── tracking/
│   │   │       └── tracking.module.ts # Real-time GPS tracking with TimescaleDB
│   │   │
│   │   ├── common/                   # Shared utilities
│   │   │   ├── guards/              # Auth guards, role guards
│   │   │   ├── interceptors/        # Logging, transform interceptors
│   │   │   ├── decorators/          # Custom decorators
│   │   │   └── filters/             # Exception filters
│   │   │
│   │   ├── config/                   # Configuration files
│   │   │                            # Database, JWT, environment configs
│   │   │
│   │   └── database/
│   │       ├── migrations/          # TypeORM database migrations
│   │       │   └── 1700000000000-InitialSchema.ts
│   │       └── seeds/               # Database seed data
│   │           └── seed-data.ts
│   │
│   ├── test/                        # E2E and integration tests
│   ├── package.json                 # Backend dependencies
│   ├── tsconfig.json                # TypeScript configuration
│   └── .env.example                 # Environment variable template
│
├── frontend/                         # React Frontend Application
│   ├── public/                      # Static assets
│   ├── index.html                   # HTML entry point
│   │
│   ├── src/
│   │   ├── main.tsx                 # React app entry, providers setup
│   │   ├── App.tsx                  # Root component with routing
│   │   │
│   │   ├── components/              # Reusable React components
│   │   │   ├── layout/
│   │   │   │   └── Layout.tsx       # Main layout with navigation
│   │   │   ├── drivers/             # Driver-specific components
│   │   │   ├── routes/              # Route-specific components
│   │   │   ├── dispatches/          # Dispatch-specific components
│   │   │   └── tracking/            # Map & tracking components
│   │   │
│   │   ├── pages/                   # Page-level components
│   │   │   ├── Dashboard.tsx        # Dashboard with stats
│   │   │   ├── DriversPage.tsx      # Driver management page
│   │   │   ├── RoutesPage.tsx       # Route planning page
│   │   │   ├── DispatchesPage.tsx   # Dispatch management page
│   │   │   └── TrackingPage.tsx     # Live tracking map page
│   │   │
│   │   ├── hooks/                   # Custom React hooks
│   │   │                            # useDrivers, useTracking, etc.
│   │   │
│   │   ├── services/                # API client services
│   │   │                            # Axios/Apollo clients, API calls
│   │   │
│   │   ├── utils/                   # Utility functions
│   │   │                            # Date formatting, calculations, etc.
│   │   │
│   │   ├── types/                   # TypeScript type definitions
│   │   │                            # API response types, models
│   │   │
│   │   └── styles/
│   │       └── index.css            # Global styles, Tailwind imports
│   │
│   ├── package.json                 # Frontend dependencies
│   ├── tsconfig.json                # TypeScript configuration
│   ├── tsconfig.node.json           # TypeScript config for Vite
│   ├── vite.config.ts               # Vite build configuration
│   ├── tailwind.config.js           # Tailwind CSS configuration
│   └── .env.example                 # Environment variable template
│
├── infrastructure/                   # Infrastructure as Code
│   ├── docker/                      # Docker configuration
│   │   ├── Dockerfile.backend       # Multi-stage backend image
│   │   ├── Dockerfile.frontend      # Multi-stage frontend image with nginx
│   │   ├── nginx.conf               # Nginx reverse proxy config
│   │   ├── docker-compose.yml       # Production compose file
│   │   ├── docker-compose.dev.yml   # Development compose file
│   │   └── init-db.sql              # TimescaleDB initialization script
│   │
│   └── k8s/                         # Kubernetes manifests
│       ├── namespace.yaml           # routing-dispatch namespace
│       ├── secrets.yaml             # Secrets template
│       ├── postgres-statefulset.yaml # PostgreSQL/TimescaleDB stateful set
│       ├── backend-deployment.yaml   # Backend deployment & service
│       ├── frontend-deployment.yaml  # Frontend deployment & service
│       └── ingress.yaml             # Ingress controller configuration
│
└── docs/                            # Documentation
    └── PROJECT-STRUCTURE.md         # This file
```

## Key Files Description

### Root Level

| File | Purpose |
|------|---------|
| `package.json` | Monorepo workspace configuration, scripts for dev/build/deploy |
| `README.md` | Main documentation, setup instructions, tech stack overview |
| `.gitignore` | Python-focused gitignore (includes Node.js, IDE, OS files) |

### Backend

| File | Purpose |
|------|---------|
| `src/main.ts` | Bootstrap NestJS app, setup CORS, Swagger, validation pipes |
| `src/app.module.ts` | Root module, configures TypeORM, GraphQL, imports feature modules |
| `src/modules/drivers/driver.entity.ts` | Driver database entity with TypeORM & GraphQL decorators |
| `src/modules/drivers/drivers.service.ts` | Driver CRUD operations, business logic |
| `src/modules/drivers/drivers.controller.ts` | REST API endpoints for drivers |
| `src/modules/drivers/drivers.resolver.ts` | GraphQL queries & mutations for drivers |
| `src/database/migrations/` | Database schema migrations (TypeORM) |
| `src/database/seeds/` | Sample data for development/testing |
| `.env.example` | Template for environment variables |

### Frontend

| File | Purpose |
|------|---------|
| `src/main.tsx` | React app entry, setup Apollo, React Query, Router providers |
| `src/App.tsx` | Root component with route definitions |
| `src/components/layout/Layout.tsx` | Main layout with navigation bar |
| `src/pages/*.tsx` | Page components for each route |
| `vite.config.ts` | Vite build config, path aliases, proxy settings |
| `tailwind.config.js` | Tailwind CSS theme configuration |
| `index.html` | HTML entry point |

### Infrastructure

| File | Purpose |
|------|---------|
| `docker/Dockerfile.backend` | Multi-stage build: deps install → compile → production image |
| `docker/Dockerfile.frontend` | Multi-stage build: Vite build → nginx serving |
| `docker/docker-compose.yml` | Production stack: postgres, backend, frontend |
| `docker/docker-compose.dev.yml` | Development stack: postgres, redis (apps run locally) |
| `docker/init-db.sql` | Enable TimescaleDB, PostGIS, create hypertable |
| `k8s/postgres-statefulset.yaml` | StatefulSet for persistent PostgreSQL/TimescaleDB |
| `k8s/backend-deployment.yaml` | Backend deployment with 3 replicas, health checks |
| `k8s/frontend-deployment.yaml` | Frontend deployment with 2 replicas |
| `k8s/ingress.yaml` | Ingress routing with TLS/SSL |

## Module Breakdown

### Backend Modules

1. **auth** - User authentication, JWT tokens, guards
2. **drivers** - Driver CRUD, status tracking, location updates
3. **vehicles** - Fleet management, capacity tracking
4. **routes** - Route optimization, waypoint management
5. **dispatches** - Dispatch assignments, priority handling
6. **tracking** - Real-time GPS tracking, TimescaleDB integration

### Frontend Components

1. **layout** - Header, sidebar, navigation components
2. **drivers** - Driver list, driver detail, driver forms
3. **routes** - Route planner, route map, route list
4. **dispatches** - Dispatch board, assignment forms
5. **tracking** - Live map with Leaflet, real-time updates

## Technology Patterns

### Backend Patterns

- **REST + GraphQL** - Dual API support for flexibility
- **Repository Pattern** - TypeORM repositories for data access
- **Dependency Injection** - NestJS built-in DI container
- **Modular Architecture** - Feature-based module organization
- **Time-Series Data** - TimescaleDB hypertables for tracking

### Frontend Patterns

- **Component Composition** - Reusable, composable components
- **Custom Hooks** - Business logic extraction
- **Server State Management** - TanStack Query + Apollo Client
- **Route-based Code Splitting** - Lazy loading with React Router
- **Utility-First CSS** - Tailwind CSS

### Database Design

- **Relational Tables** - drivers, vehicles, routes, dispatches
- **Hypertable** - tracking_events (time-series with TimescaleDB)
- **Geospatial** - PostGIS geography columns for locations
- **Indexes** - Optimized for location queries, time-range queries
- **Retention Policy** - 90-day automatic data retention

## Getting Started

Refer to the main [README.md](../README.md) for setup instructions and development workflow.
