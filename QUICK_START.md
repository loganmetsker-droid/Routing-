# Quick Start Guide

## Fixed: Stripe Configuration Issue

The backend now starts successfully without requiring Stripe API keys. Stripe features are **optional** for development.

## Canonical Stack

Use the **NestJS backend** in `backend/` plus the **routing-service** in `routing-service/`. The Express and Vercel serverless backends are legacy and deprecated.

## Launch Options

### Option 1: Docker Compose (Full Stack)

```bash
cd /c/Users/lmets/OneDrive/Desktop/my-awesome-project
docker compose up --build
```

**Services Started:**
- PostgreSQL + TimescaleDB (port 5432)
- Redis (port 6379)
- Backend API (port 3000)
- Frontend (port 5173)
- OSRM Routing Service (port 5000)

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- GraphQL Playground: http://localhost:3000/graphql

**Known Issue:** Backend may crash on first startup. Fix:
```bash
docker compose restart backend
```

### Option 2: Local Development (Recommended for Development)

**Terminal 1 - Start Database & Redis:**
```bash
cd /c/Users/lmets/OneDrive/Desktop/my-awesome-project
docker compose up postgres redis -d
```

**Terminal 2 - Start Backend:**
```bash
cd /c/Users/lmets/OneDrive/Desktop/my-awesome-project/backend
npm install
npm run dev
```

**Terminal 3 - Start Frontend:**
```bash
cd /c/Users/lmets/OneDrive/Desktop/my-awesome-project/frontend
npm install
npm run dev
```

## What's Working

✅ **Backend (NestJS)**
- GraphQL API at http://localhost:3000/graphql
- REST endpoints
- TypeORM with PostgreSQL
- All modules loaded (Stripe optional)

✅ **Frontend (React + Vite)**
- Material-UI components
- Apollo Client GraphQL integration
- Pages: Dashboard, Drivers, Vehicles, Routes, Jobs, Login
- TypeScript build successful

✅ **Database**
- PostgreSQL with TimescaleDB extension
- Redis for caching

✅ **Routing Service (OSRM)**
- Map data loaded (Monaco region)
- Route calculations working
- Available at http://localhost:8080

✅ **Routing Optimization Service (FastAPI)**
- Route optimization endpoints (`/route`, `/route/global`)
- Default port: http://localhost:8000 (configure `ROUTING_SERVICE_URL` in backend)

## Optional: Enable Stripe Features

To enable subscription features, add your Stripe API keys to `.env`:

```bash
STRIPE_SECRET_KEY=sk_test_your_actual_stripe_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

Get keys from: https://dashboard.stripe.com/test/apikeys

## Testing the App

1. Start the backend and frontend (see options above)
2. Open http://localhost:5173 in your browser
3. You should see the Dashboard with 4 stat cards
4. Navigate using the left sidebar:
   - Dashboard
   - Drivers
   - Vehicles
   - Routes (with map)
   - Jobs

## GraphQL Playground

Visit http://localhost:3000/graphql to test queries:

```graphql
query {
  drivers {
    id
    name
    phone
    status
  }
}
```

## Stopping Services

**Docker Compose:**
```bash
docker compose down
```

**Local Development:**
- Press `Ctrl+C` in each terminal
- Stop Docker services: `docker compose down postgres redis`

## Next Steps

1. Add sample data via GraphQL mutations
2. Configure Stripe (optional)
3. Customize the frontend theme in `frontend/src/theme.ts`
4. Add authentication logic to LoginPage

## Troubleshooting

**Backend won't start:**
- Check if PostgreSQL is running: `docker ps`
- Check logs: `docker compose logs backend`

**Frontend build errors:**
- Delete `node_modules` and reinstall: `npm install`
- Check Apollo Client version: `npm list @apollo/client` (should be 3.x)

**Database connection errors:**
- Wait 10 seconds after starting postgres
- Or restart backend: `docker compose restart backend`
