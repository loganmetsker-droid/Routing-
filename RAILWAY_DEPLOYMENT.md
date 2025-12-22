# Deploy Backend to Railway

## Quick Setup (5 minutes)

### 1. Create Railway Account & Project
1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your `Routing-` repository
6. Select the `backend` folder as root directory

### 2. Add PostgreSQL Database
1. In your Railway project, click "+ New"
2. Select "Database" → "PostgreSQL"
3. Railway will automatically create a database

### 3. Add Redis Cache
1. Click "+ New" again
2. Select "Database" → "Redis"
3. Railway will automatically create a Redis instance

### 4. Configure Environment Variables

Click on your backend service → "Variables" → "Raw Editor" and paste:

```
NODE_ENV=production
PORT=3000

# Database (Railway will auto-populate these from PostgreSQL service)
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_USERNAME=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_DATABASE=${{Postgres.PGDATABASE}}

# Redis (Railway will auto-populate these from Redis service)
REDIS_HOST=${{Redis.REDIS_HOST}}
REDIS_PORT=${{Redis.REDIS_PORT}}

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# CORS
CORS_ORIGIN=https://frontend-seven-mu-49.vercel.app

# GraphQL
GRAPHQL_PLAYGROUND=false
GRAPHQL_INTROSPECTION=false

# OSRM (use public server or deploy your own)
OSRM_URL=http://router.project-osrm.org
```

### 5. Deploy

1. Railway will automatically deploy after you push to GitHub
2. Or click "Deploy" in the Railway dashboard
3. Wait 3-5 minutes for the build to complete

### 6. Get Your Backend URL

After deployment:
1. Click on your backend service
2. Go to "Settings" → "Domains"
3. Click "Generate Domain"
4. Copy the URL (e.g., `https://backend-production-xxxx.up.railway.app`)

### 7. Update Vercel Frontend

Go to https://vercel.com/logandriods-projects/frontend/settings/environment-variables

Update these variables:
```
VITE_API_URL=https://your-railway-backend-url.up.railway.app
VITE_GRAPHQL_URL=https://your-railway-backend-url.up.railway.app/graphql
VITE_WS_URL=wss://your-railway-backend-url.up.railway.app
```

Click "Save" and redeploy.

---

## Alternative: Deploy via Railway CLI

```bash
# From the backend directory
cd backend

# Login to Railway (opens browser)
railway login

# Initialize project
railway init

# Link to PostgreSQL and Redis
railway add --database postgresql
railway add --database redis

# Set environment variables
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=your-secret-key

# Deploy
railway up
```

---

## Verify Deployment

1. Visit `https://your-backend-url/health` - should return healthy status
2. Visit `https://your-backend-url/graphql` - GraphQL playground (if enabled)
3. Check Railway logs for any errors

---

## Cost Estimate

Railway pricing:
- Hobby Plan: $5/month (500 hours execution time)
- Includes PostgreSQL and Redis
- Perfect for small-medium projects

Your backend should cost ~$5-10/month depending on usage.

---

## Troubleshooting

**Build Fails:**
- Check Railway logs for errors
- Ensure Node version is 20.x
- Verify all dependencies are in package.json

**Database Connection Fails:**
- Ensure PostgreSQL service is running
- Check that environment variables reference the right service names
- Verify `${{Postgres.PGHOST}}` syntax

**CORS Errors:**
- Update CORS_ORIGIN to match your Vercel frontend URL
- Redeploy after changing environment variables

**Health Check Fails:**
- Ensure `/health` endpoint exists in your backend
- Check that PORT is set to 3000
- Verify the app is actually starting (check logs)
