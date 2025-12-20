# Database Setup Guide

## Issue
The backend can't connect to PostgreSQL. You need to set up the database first.

## Quick Setup Options

### Option 1: Install PostgreSQL Locally (Recommended for Development)

1. **Download and Install PostgreSQL**
   - Download from: https://www.postgresql.org/download/windows/
   - During installation, set password to: `postgres` (or update `.env` with your password)
   - Default port: 5432

2. **Create the Database**
   Open Command Prompt or PowerShell and run:
   ```bash
   # Connect to PostgreSQL
   psql -U postgres

   # Create database
   CREATE DATABASE fleet_management;

   # Exit psql
   \q
   ```

3. **Update backend/.env** (already created with defaults)
   ```env
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/fleet_management
   ```

4. **Restart the backend**

### Option 2: Use Docker (Easiest)

Run PostgreSQL in Docker:
```bash
docker run --name fleet-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=fleet_management -p 5432:5432 -d postgres:15
```

The backend `.env` is already configured for this setup.

### Option 3: Use a Cloud Database

**ElephantSQL (Free tier):**
1. Sign up at https://www.elephantsql.com/
2. Create a new instance
3. Copy the connection URL
4. Update `backend/.env`:
   ```env
   DATABASE_URL=your-elephantsql-connection-url
   ```

**Supabase (Free tier):**
1. Sign up at https://supabase.com/
2. Create a new project
3. Get the database connection string
4. Update `backend/.env`

## After Database is Ready

1. **Run database migrations:**
   ```bash
   cd backend
   npm run typeorm migration:run
   ```

2. **Start the backend:**
   ```bash
   npm run dev
   ```

3. **Verify it's working:**
   - Backend should start on http://localhost:3000
   - GraphQL playground: http://localhost:3000/graphql

## Current Configuration

Your `backend/.env` file has been created with these defaults:
- **Database**: `fleet_management`
- **User**: `postgres`
- **Password**: `postgres` (⚠️ change for production!)
- **Host**: `localhost`
- **Port**: `5432`

## Troubleshooting

### "Connection refused" error
- PostgreSQL is not running
- **Solution**: Start PostgreSQL service or use Docker option

### "Password authentication failed"
- Wrong password in `.env`
- **Solution**: Update `DATABASE_PASSWORD` in `backend/.env`

### "Database does not exist"
- Database hasn't been created
- **Solution**: Run `CREATE DATABASE fleet_management;` in psql

### Port 5432 already in use
- Another service is using the port
- **Solution**: Change PostgreSQL port or stop the other service

## Next Steps

1. Choose one of the setup options above
2. Create/start the PostgreSQL database
3. Run migrations: `cd backend && npm run typeorm migration:run`
4. Start backend: `npm run dev`
5. Start frontend: `cd ../frontend && npm run dev`

Your application will then be ready at:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3000
- **GraphQL**: http://localhost:3000/graphql
