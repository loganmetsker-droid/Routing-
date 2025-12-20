# How to Start Your Fleet Management Application

## Prerequisites
Make sure you have:
- Node.js installed
- PostgreSQL running on localhost:5432
- Database credentials configured in backend/.env

## Starting the Application

### Option 1: Using separate terminals (recommended)

**Terminal 1 - Start Backend:**
```bash
cd C:\Users\lmets\OneDrive\Desktop\my-awesome-project\backend
npm run dev
```

**Terminal 2 - Start Frontend:**
```bash
cd C:\Users\lmets\OneDrive\Desktop\my-awesome-project\frontend
npm run dev
```

### Option 2: Using npm workspaces from root

**Start Backend:**
```bash
cd C:\Users\lmets\OneDrive\Desktop\my-awesome-project
npm run dev --workspace=@routing-dispatch/backend
```

**Start Frontend:**
```bash
cd C:\Users\lmets\OneDrive\Desktop\my-awesome-project
npm run dev --workspace=@routing-dispatch/frontend
```

## Access URLs

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **GraphQL Playground**: http://localhost:3000/graphql

## Troubleshooting

### Backend won't start
- Check if PostgreSQL is running
- Verify database credentials in `backend/.env`
- Run: `cd backend && npm install`

### Frontend won't start
- Run: `cd frontend && npm install`
- Check if port 5173 is available

### Database connection issues
- Ensure PostgreSQL is running
- Check `backend/.env` has correct DATABASE_URL
- Try: `npm run migration:run --workspace=@routing-dispatch/backend`

## Quick Commands Reference

```bash
# Install all dependencies
npm install

# Install backend only
cd backend && npm install

# Install frontend only
cd frontend && npm install

# Build backend
cd backend && npm run build

# Build frontend  
cd frontend && npm run build

# Run tests
npm test --workspace=@routing-dispatch/backend
npm test --workspace=@routing-dispatch/frontend
```
