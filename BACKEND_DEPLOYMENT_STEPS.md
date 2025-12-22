# Connect Backend to Vercel Frontend

## Step 1: Deploy to Railway (Browser Method - Easiest)

### A. Create Railway Project
1. Open: https://railway.app
2. Click **"Login"** → Sign in with GitHub
3. Click **"New Project"**
4. Select **"Deploy from GitHub repo"**
5. Choose **`Routing-`** from your repositories
6. Click **"Add variables"** (skip for now, we'll add them next)

### B. Configure Root Directory
1. Click on your service (it will say "loganmetsker-droid/Routing-")
2. Go to **"Settings"** tab
3. Scroll to **"Root Directory"**
4. Set it to: `backend`
5. Click **"Save"**

### C. Add PostgreSQL Database
1. In your Railway project dashboard, click **"+ New"**
2. Select **"Database"** → **"PostgreSQL"**
3. Wait for it to provision (~30 seconds)

### D. Add Redis Cache
1. Click **"+ New"** again
2. Select **"Database"** → **"Redis"**
3. Wait for it to provision (~30 seconds)

### E. Set Environment Variables
1. Click on your **backend service** (not database)
2. Go to **"Variables"** tab
3. Click **"Raw Editor"**
4. Paste this (Railway will auto-fill the database variables):

```
NODE_ENV=production
PORT=3000

# Database (auto-populated by Railway)
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_USERNAME=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_DATABASE=${{Postgres.PGDATABASE}}

# Redis (auto-populated by Railway)
REDIS_HOST=${{Redis.REDIS_HOST}}
REDIS_PORT=${{Redis.REDIS_PORT}}

# JWT - CHANGE THIS!
JWT_SECRET=super-secret-change-me-in-production-abc123xyz789

# CORS - Your Vercel frontend URL
CORS_ORIGIN=https://frontend-seven-mu-49.vercel.app

# GraphQL
GRAPHQL_PLAYGROUND=false
GRAPHQL_INTROSPECTION=false

# OSRM Routing
OSRM_URL=http://router.project-osrm.org
```

5. Click **"Save"** or **"Update Variables"**

### F. Deploy!
1. Railway will automatically start deploying
2. Watch the **"Deployments"** tab - takes 3-5 minutes
3. Wait for **"SUCCESS"** status ✅

### G. Get Your Backend URL
1. Go to **"Settings"** tab
2. Scroll to **"Networking"** → **"Public Networking"**
3. Click **"Generate Domain"**
4. Copy the URL (e.g., `backend-production-xxxx.up.railway.app`)

---

## Step 2: Connect Vercel Frontend to Railway Backend

### A. Update Vercel Environment Variables
1. Open: https://vercel.com/logandriods-projects/frontend/settings/environment-variables
2. Find and **edit** these three variables:

**VITE_API_URL**
- Current: `http://your-backend-url`
- Change to: `https://your-railway-url.up.railway.app`
- Example: `https://backend-production-a1b2.up.railway.app`

**VITE_GRAPHQL_URL**
- Current: `http://your-backend-url/graphql`
- Change to: `https://your-railway-url.up.railway.app/graphql`
- Example: `https://backend-production-a1b2.up.railway.app/graphql`

**VITE_WS_URL**
- Current: `ws://your-backend-url`
- Change to: `wss://your-railway-url.up.railway.app`
- Example: `wss://backend-production-a1b2.up.railway.app`

3. Click **"Save"** for each variable

### B. Redeploy Vercel
1. Go to: https://vercel.com/logandriods-projects/frontend
2. Click **"Deployments"** tab
3. Click the **three dots** on the latest deployment
4. Click **"Redeploy"**
5. Wait 1-2 minutes

---

## Step 3: Test Your Live App!

1. Visit: https://frontend-seven-mu-49.vercel.app
2. You should see:
   - Dashboard loads ✅
   - No "Failed to fetch" errors ✅
   - Map displays ✅
   - Data shows up ✅

### Verify Backend Health:
Visit: `https://your-railway-url.up.railway.app/health`
Should return:
```json
{
  "status": "ok",
  "database": "healthy",
  "redis": "healthy"
}
```

---

## Troubleshooting

### Railway Build Fails
**Check the build logs:**
1. Railway → Deployments tab → Click failed deployment
2. Look for error messages
3. Common fixes:
   - Ensure `backend/package.json` exists
   - Verify Node version is 20.x
   - Check that `railway.json` and `nixpacks.toml` are in the `backend` folder

### Database Connection Errors
**Check environment variables:**
1. Railway → Variables tab
2. Ensure `${{Postgres.PGHOST}}` references match your database service name
3. If PostgreSQL service is named differently, update the references

### CORS Errors in Browser
**Check CORS_ORIGIN:**
1. Railway → Variables tab
2. Ensure `CORS_ORIGIN` matches your Vercel URL exactly
3. No trailing slash!
4. Redeploy after changing

### Frontend Still Shows "Failed to Fetch"
**Check Vercel variables:**
1. Ensure all three variables (`VITE_API_URL`, `VITE_GRAPHQL_URL`, `VITE_WS_URL`) are set
2. Ensure they use `https://` and `wss://` (not `http://` and `ws://`)
3. Redeploy Vercel after changing variables

### Health Check Returns 404
**Check backend routes:**
1. Ensure backend has a `/health` endpoint
2. Check Railway logs for startup errors
3. Verify PORT is set to 3000

---

## Cost Summary

**Railway:**
- Hobby Plan: $5/month
- Includes: 500 hours execution time + PostgreSQL + Redis
- Your setup: ~$5-10/month depending on usage

**Vercel:**
- Free tier (what you're using now)
- Generous limits for personal projects

**Total Monthly Cost:** ~$5-10

---

## You're Done! 🚀

Your full-stack routing & dispatch platform is now live:
- ✅ Frontend deployed on Vercel
- ✅ Backend deployed on Railway
- ✅ PostgreSQL database running
- ✅ Redis cache running
- ✅ All services connected

Share your app: https://frontend-seven-mu-49.vercel.app
