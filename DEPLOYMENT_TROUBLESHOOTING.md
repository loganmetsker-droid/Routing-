# Deployment Troubleshooting Guide

## Common Deployment Issues & Solutions

### 1. Database Connection Errors

#### Error: `Connection terminated unexpectedly` or `read ECONNRESET`

**Symptoms:**
```
[Nest] ERROR [TypeOrmModule] Unable to connect to the database. Retrying...
Error: Connection terminated unexpectedly
Error: read ECONNRESET
```

**Causes & Solutions:**

**A. DATABASE_URL Not Set or Incorrect**
- **Check:** Verify DATABASE_URL is set in your deployment platform
  - Render: Settings → Environment → Environment Variables
  - Railway: Variables tab
- **Format:** Must be `postgresql://user:password@host:port/database`
- **Common mistakes:**
  - Using `postgres://` instead of `postgresql://` (both work, but check consistency)
  - Missing port (should be `:5432` typically)
  - Special characters in password not URL-encoded

**B. Database Not Created**
- Render: Create a PostgreSQL service first, then connect it to your web service
- Railway: Add PostgreSQL plugin, link to your project
- **Verify:** The database name in the URL matches an actual database

**C. Connection Pool Limits**
- **Free tier limits:** Most providers limit concurrent connections (usually 5)
- **Solution:** Database config now uses max 3 connections in production
- **Check:** If multiple services connect to same DB, reduce connections per service

**D. SSL Configuration**
- **Production databases require SSL**
- **Current config:** `ssl: { rejectUnauthorized: false }` in production
- **If still failing:**
  - Some providers need `sslmode=require` in the URL:
    `postgresql://user:pass@host:5432/db?sslmode=require`

**E. Cold Start Delays**
- **Issue:** Database may not be ready when app starts
- **Solution:** Config now includes:
  - 10 retry attempts (was 5)
  - 3-second delays between retries
  - 30-second connection timeout

### 2. Port Binding Errors

#### Error: `No open ports detected`

**Symptoms:**
```
==> No open ports detected, continuing to scan...
```

**Solution:**
- App must listen on `process.env.PORT` (already configured in main.ts:78)
- Bind to `0.0.0.0` not `localhost` (already configured in main.ts:79)
- **If app crashes before port binding:** Fix the crash (usually database connection)

### 3. Build Failures

#### TypeScript Compilation Errors

**Symptoms:**
```
error TS2322: Type 'X' is not assignable to type 'Y'
```

**Solution:**
- Update dependencies: `npm update` in backend folder
- Check package versions match between local and deployment
- Recent fix: Stripe API version updated to `2026-01-28.clover`

### 4. Environment-Specific Issues

#### Works Locally, Fails in Production

**Checklist:**
1. **Environment Variables**
   - [ ] DATABASE_URL set
   - [ ] NODE_ENV=production
   - [ ] PORT (usually auto-set by platform)
   - [ ] Any API keys (Stripe, etc.)

2. **Database Migrations**
   - [ ] Migrations exist in `backend/src/database/migrations/`
   - [ ] Run migrations after deploy: `npm run migration:run`
   - [ ] Or use `migrationsRun: true` in database config (not recommended for prod)

3. **Build Configuration**
   - [ ] Dockerfile exists and is correct
   - [ ] Start command: `npm run start:prod` or similar
   - [ ] Health check endpoint working: `/health`

## Render-Specific Setup

### Step-by-Step Deployment

1. **Create PostgreSQL Database**
   - Dashboard → New → PostgreSQL
   - Note the "Internal Database URL" (starts with `postgresql://`)

2. **Create Web Service**
   - Dashboard → New → Web Service
   - Connect your GitHub repo
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start:prod`

3. **Environment Variables**
   ```env
   NODE_ENV=production
   DATABASE_URL=[Internal Database URL from step 1]
   PORT=[auto-set by Render]
   ```

4. **Advanced Settings (Optional)**
   ```env
   # If using Stripe
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...

   # Frontend URL for CORS
   FRONTEND_URL=https://your-frontend.onrender.com

   # Database pool
   DB_POOL_SIZE=3
   ```

5. **Deploy**
   - Push to GitHub (triggers auto-deploy)
   - Or click "Manual Deploy" in Render dashboard

### Debugging on Render

**View Logs:**
```bash
# Install Render CLI
npm install -g @render/cli

# Login
render login

# Stream logs
render logs [service-name]
```

**Health Check:**
```bash
curl https://your-app.onrender.com/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" }
  }
}
```

## Railway-Specific Setup

### Step-by-Step Deployment

1. **Create New Project**
   - Dashboard → New Project
   - "Deploy from GitHub repo"

2. **Add PostgreSQL**
   - Project → New → Database → Add PostgreSQL
   - Railway auto-creates `DATABASE_URL` variable

3. **Configure Backend Service**
   - **Build Command:** Leave empty (uses Dockerfile or npm scripts)
   - **Start Command:** Leave empty (uses Dockerfile CMD)

4. **Environment Variables**
   ```env
   NODE_ENV=production
   ```
   (DATABASE_URL is auto-set by Railway)

5. **Generate Domain**
   - Settings → Generate Domain
   - Note the URL for your frontend CORS config

## Quick Diagnostic Commands

### Test Database Connection
```bash
# Using psql
psql "$DATABASE_URL"

# Using Node.js
node -e "const { Client } = require('pg'); const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }); c.connect().then(() => console.log('Connected!')).catch(e => console.error(e))"
```

### Check Environment Variables (in deployed app)
Add temporary endpoint:
```typescript
@Get('debug/env')
getEnv() {
  return {
    nodeEnv: process.env.NODE_ENV,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    port: process.env.PORT,
  };
}
```

## Recent Fixes Applied

### 2026-01-29: Database Connection Improvements
- ✅ Reduced production pool size from 5 to 3 connections
- ✅ Increased connection timeout to 30 seconds (was 10s)
- ✅ Increased retry attempts to 10 (was 5)
- ✅ Added DATABASE_URL format validation
- ✅ Improved error logging with specific troubleshooting hints

### 2026-01-29: Stripe API Version Update
- ✅ Updated from `2025-12-15.clover` to `2026-01-28.clover`
- ✅ Resolves TypeScript compilation errors in Docker build

## Still Having Issues?

1. **Check the logs** - Most issues show clear error messages
2. **Verify DATABASE_URL** - Format: `postgresql://user:pass@host:5432/dbname`
3. **Check connection limits** - Free tiers usually allow max 5 connections
4. **Test locally with production settings:**
   ```bash
   NODE_ENV=production DATABASE_URL=your_prod_url npm run start:prod
   ```
5. **Simplify** - Comment out non-essential modules (Stripe, Bull, etc.) to isolate the issue

## Useful Resources

- [Render PostgreSQL Docs](https://render.com/docs/databases)
- [Railway PostgreSQL Docs](https://docs.railway.app/databases/postgresql)
- [NestJS TypeORM Docs](https://docs.nestjs.com/techniques/database)
- [TypeORM Connection Options](https://typeorm.io/data-source-options)
