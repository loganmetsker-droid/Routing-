# Deploy Backend to Render.com (Free Tier)

## Step-by-Step Deployment Guide

### Step 1: Create Render Account

1. Go to: https://render.com
2. Click **"Get Started"** or **"Sign Up"**
3. Choose **"Sign up with GitHub"**
4. Authorize Render to access your GitHub repos
5. Complete your profile

---

### Step 2: Create PostgreSQL Database

**Do this FIRST before creating the web service:**

1. In Render dashboard, click **"New +"** (top right)
2. Select **"PostgreSQL"**
3. Configure:
   - **Name:** `routing-dispatch-db`
   - **Database:** `routing_dispatch` (auto-filled)
   - **User:** `routing_dispatch` (auto-filled)
   - **Region:** Choose closest to you (e.g., Ohio/Oregon for US)
   - **Plan:** **FREE** ✅
4. Click **"Create Database"**
5. Wait ~30 seconds for it to provision
6. **IMPORTANT:** Click on the database, go to "Info" tab
7. **Copy the "Internal Database URL"** - you'll need this!

---

### Step 3: Create Web Service for Backend

1. Click **"New +"** → **"Web Service"**
2. Select **"Build and deploy from a Git repository"** → **Next**
3. Find and click **"Connect"** next to your `Routing-` repository
4. Configure the service:

**Basic Settings:**
- **Name:** `routing-dispatch-backend`
- **Region:** Same as your database (e.g., Ohio)
- **Branch:** `main`
- **Root Directory:** `backend` ⚠️ **IMPORTANT!**
- **Runtime:** `Node`

**Build & Deploy:**
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm run start:prod`

**Plan:**
- Select **"Free"** plan ✅

5. Click **"Advanced"** to add environment variables

---

### Step 4: Add Environment Variables

In the **Environment Variables** section, click **"Add Environment Variable"** for each:

**Required Variables:**

```
NODE_ENV=production
```

```
PORT=3000
```

```
DATABASE_URL=${{routing-dispatch-db.DATABASE_URL}}
```
⚠️ **OR** if that doesn't work, paste the Internal Database URL you copied earlier

```
JWT_SECRET=super-secret-change-this-in-production-abc123
```

```
CORS_ORIGIN=https://frontend-seven-mu-49.vercel.app
```

```
GRAPHQL_PLAYGROUND=false
```

```
GRAPHQL_INTROSPECTION=false
```

```
OSRM_URL=http://router.project-osrm.org
```

**Database Variables (from your PostgreSQL service):**

If your backend uses separate DB variables instead of DATABASE_URL:

```
DB_HOST=<from PostgreSQL Internal Hostname>
DB_PORT=5432
DB_USERNAME=<from PostgreSQL User>
DB_PASSWORD=<from PostgreSQL Password>
DB_DATABASE=<from PostgreSQL Database>
```

You can find these in your PostgreSQL service → "Info" tab.

6. Click **"Create Web Service"**

---

### Step 5: Wait for Deployment

**What happens:**
- Render will start building your app
- You'll see live build logs
- Takes 3-5 minutes for first deploy
- Status will change to **"Live"** when ready ✅

**Monitor the logs:**
- Click on your web service
- Go to **"Logs"** tab
- Watch for errors or success messages

---

### Step 6: Get Your Backend URL

Once deployed:

1. Click on your **routing-dispatch-backend** service
2. At the top, you'll see your URL:
   - Format: `https://routing-dispatch-backend.onrender.com`
3. **Copy this URL!**

---

### Step 7: Test Your Backend

Visit in browser:
```
https://your-render-url.onrender.com/health
```

Should return:
```json
{
  "status": "ok",
  "database": "healthy"
}
```

---

### Step 8: Update Vercel Frontend

Go to: https://vercel.com/logandriods-projects/frontend/settings/environment-variables

Update these 3 variables:

**VITE_API_URL**
```
https://your-render-url.onrender.com
```

**VITE_GRAPHQL_URL**
```
https://your-render-url.onrender.com/graphql
```

**VITE_WS_URL**
```
wss://your-render-url.onrender.com
```

Click **"Save"** → Go to Deployments tab → **"Redeploy"**

---

### Step 9: Add Redis (Optional - If Needed)

Render's free tier doesn't include Redis. Options:

**Option A: Use Upstash Redis (Free tier available)**
1. Go to: https://upstash.com
2. Sign up with GitHub
3. Create a Redis database (free tier: 10K commands/day)
4. Copy the connection URL
5. Add to Render environment variables:
   ```
   REDIS_URL=<your-upstash-redis-url>
   ```

**Option B: Disable Redis for now**
1. Edit your backend code to make Redis optional
2. Comment out Redis-dependent features

**Option C: Use Railway Redis only**
Since you already set up Redis on Railway, you could:
1. Keep Railway account (free tier might allow just Redis)
2. Get Redis connection URL from Railway
3. Add it to Render environment variables

---

## Troubleshooting

### Build Fails: "Cannot find module"
- Ensure **Root Directory** is set to `backend`
- Check that `backend/package.json` exists in your repo
- Verify build command: `npm install && npm run build`

### Database Connection Fails
- Go to PostgreSQL service → "Info" tab
- Copy **Internal Database URL** (not External)
- Update `DATABASE_URL` environment variable in your web service
- Redeploy

### "Service Unavailable" or 503 Error
- Check logs for errors
- Verify start command: `npm run start:prod`
- Ensure PORT is set to `3000` or remove it (Render auto-assigns)
- Free tier services spin down after 15 min of inactivity (takes 30s to wake up)

### CORS Errors
- Verify `CORS_ORIGIN` matches your Vercel URL exactly
- No trailing slash
- Must be `https://`

### Logs Show "Cannot connect to database"
- Ensure database is in same region as web service
- Use **Internal Database URL**, not External
- Check database status (should be "Available")

---

## Render Free Tier Limitations

**What's Included (FREE):**
- ✅ 750 hours/month (enough for 1 service running 24/7)
- ✅ PostgreSQL database (1GB storage, expires after 90 days)
- ✅ Auto-deploy from GitHub
- ✅ HTTPS/SSL included
- ✅ Custom domains

**Limitations:**
- ⏱️ Services spin down after 15 min of inactivity
- ⏱️ Takes ~30 seconds to wake up on first request
- ❌ No Redis on free tier (use Upstash instead)
- 📅 PostgreSQL deleted after 90 days (upgrade to keep it)

---

## Cost to Upgrade (Optional)

If you want always-on service:

**Render Starter Plan:** $7/month
- Services never spin down
- PostgreSQL doesn't expire
- Priority support

---

## You're Done! 🚀

Your backend is now:
- ✅ Deployed on Render (FREE)
- ✅ Connected to PostgreSQL
- ✅ Has a public URL
- ✅ Auto-deploys from GitHub

**Next Steps:**
1. Test your backend health endpoint
2. Update Vercel environment variables
3. Test your live frontend!

**Your live app:** https://frontend-seven-mu-49.vercel.app
