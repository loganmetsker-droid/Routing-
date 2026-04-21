# Fleet Management System - Full Stack Application

A modern fleet management system built with NestJS, GraphQL, React, and PostgreSQL.

## ✅ Canonical Backend

The backend in this repo is the NestJS app in `backend/`.

## 🎯 Current Status

✅ **Backend**: Fully implemented with GraphQL API  
✅ **Frontend**: Complete React UI with all pages  
⚠️ **Database**: Needs PostgreSQL setup (see below)

## 🚀 Quick Start

### 1. Set Up Database (REQUIRED FIRST)

Choose one option:

**Option A - Docker (Easiest):**
```bash
docker run --name fleet-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=fleet_management -p 5432:5432 -d postgres:15
```

**Option B - Local PostgreSQL:**
- Install PostgreSQL from https://www.postgresql.org/download/
- Create database: `CREATE DATABASE fleet_management;`

**See `SETUP_DATABASE.md` for detailed instructions.**

### 2. Start Backend

```bash
cd backend
npm install
npm run dev
```

Backend runs at: http://localhost:3000  
GraphQL Playground: http://localhost:3000/graphql

### 3. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: http://localhost:5173

## 📁 Project Structure

```
my-awesome-project/
├── backend/                    # NestJS backend
│   ├── src/
│   │   ├── drivers/           # Driver management
│   │   ├── vehicles/          # Vehicle management
│   │   ├── jobs/              # Job management
│   │   ├── routes/            # Route planning
│   │   ├── dispatches/        # Dispatch system
│   │   └── auth/              # JWT authentication
│   └── package.json
│
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── pages/             # All UI pages
│   │   │   ├── Dashboard.tsx
│   │   │   ├── DriversPage.tsx
│   │   │   ├── VehiclesPage.tsx
│   │   │   ├── JobsPage.tsx
│   │   │   ├── RoutesPage.tsx
│   │   │   └── LoginPage.tsx
│   │   ├── components/        # Layout components
│   │   └── apollo/            # Apollo Client setup
│   └── package.json
│
├── SETUP_DATABASE.md          # Database setup guide
├── START_APPS.md              # Startup instructions
└── README.md                  # This file
```

## 🛠️ Tech Stack

### Backend
- **NestJS** - Node.js framework
- **GraphQL** - API layer
- **TypeORM** - Database ORM
- **PostgreSQL** - Database
- **JWT** - Authentication
- **Bull** - Job queues
- **Redis** - Caching
- **Routing Service** - FastAPI + OR-Tools optimization (see `routing-service/`)

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Apollo Client** - GraphQL client
- **Material-UI v5** - Component library
- **React Router v6** - Routing
- **Leaflet** - Map visualization
- **Vite** - Build tool

## 📚 Features

### Implemented
- ✅ Driver management (CRUD operations)
- ✅ Vehicle tracking and maintenance
- ✅ Job/task management
- ✅ Route planning and optimization
- ✅ Dispatch system
- ✅ Real-time tracking
- ✅ GraphQL API with subscriptions
- ✅ JWT authentication
- ✅ Interactive map interface
- ✅ Responsive Material-UI design

### Dashboard Features
- Total drivers count
- Total vehicles count
- Active jobs monitoring
- Routes overview

## 🔧 Configuration

### Backend (.env)
Already created with defaults. Update if needed:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fleet_management
JWT_SECRET=your-secret-key
REDIS_HOST=localhost
PORT=3000
```

### Frontend
GraphQL endpoint configured in `frontend/src/apollo/client.ts`:
```typescript
uri: 'http://localhost:3000/graphql'
```

## 📖 Documentation

- **Database Setup**: `SETUP_DATABASE.md`
- **Starting Apps**: `START_APPS.md`
- **Troubleshooting**: `TROUBLESHOOTING.md`
- **Testing**: `TESTING_GUIDE.md`
- **OSRM Setup**: `OSRM_SETUP.md`
- **Tracking Setup**: `TRACKING_SETUP.md`
- **Workflow Guide**: `CLAUDE.md`
## 🐛 Troubleshooting

### Backend won't start
**Error**: `Unable to connect to the database`  
**Solution**: PostgreSQL isn't running. See `SETUP_DATABASE.md`

### Frontend build errors
**Error**: Apollo Client types not found  
**Solution**: Run `npm install` in frontend directory

### Port already in use
**Backend (3000)**: Change `PORT` in `backend/.env`  
**Frontend (5173)**: Change in `frontend/vite.config.ts`

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests  
cd frontend
npm test
```

## 📦 Building for Production

### Backend
```bash
cd backend
npm run build
npm run start:prod
```

### Frontend
```bash
cd frontend
npm run build
npm run preview
```

## 🔐 Security Notes

⚠️ **Before deploying to production:**
1. Change `JWT_SECRET` in `.env`
2. Use strong database password
3. Enable HTTPS
4. Configure proper CORS
5. Add rate limiting
6. Enable Helmet.js security headers

## 📝 License

ISC

## 👥 Support

For issues or questions, check:
- `SETUP_DATABASE.md`
- `START_APPS.md`
- `TROUBLESHOOTING.md`
- `TESTING_GUIDE.md`
- `frontend/src/App.tsx`
- `frontend/src/components/Layout.tsx`

---

**Built with ❤️ using NestJS, React, and GraphQL**
