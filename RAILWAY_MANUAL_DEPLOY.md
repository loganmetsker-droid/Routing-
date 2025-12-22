# Railway Manual Deployment - Step by Step

Since automatic deployment isn't triggering from GitHub, let's deploy manually using Railway CLI.

## Prerequisites
✅ Railway CLI installed (you have v4.16.1)
✅ GitHub repo `Routing-` exists
✅ Backend code in `backend` folder

---

## Step 1: Login to Railway

Open your terminal/command prompt and run:

```bash
cd my-awesome-project/backend
railway login
```

**What happens:**
- A browser window will open
- Log in with your GitHub account
- Terminal will confirm "Logged in as [your-email]"

---

## Step 2: Link to Your Existing Project

```bash
railway link
```

**What to do:**
- It will show a list of your Railway projects
- Use arrow keys to select your `Routing-` project (or whatever you named it)
- Press Enter
- It will confirm "Linked to [project-name]"

**OR** if you want to start completely fresh:

```bash
railway init
```

- Name it: `routing-dispatch-backend`
- This creates a brand new project

---

## Step 3: Add PostgreSQL Database

```bash
railway add --database postgresql
```

**What happens:**
- Railway provisions a PostgreSQL database
- Takes ~30 seconds
- Confirms "PostgreSQL added successfully"

---

## Step 4: Add Redis Cache

```bash
railway add --database redis
```

**What happens:**
- Railway provisions Redis
- Takes ~30 seconds
- Confirms "Redis added successfully"

---

## Step 5: Set Environment Variables

Create all the env vars at once:

```bash
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set JWT_SECRET=super-secret-change-this-abc123xyz789
railway variables set CORS_ORIGIN=https://frontend-seven-mu-49.vercel.app
railway variables set GRAPHQL_PLAYGROUND=false
railway variables set GRAPHQL_INTROSPECTION=false
railway variables set OSRM_URL=http://router.project-osrm.org
```

**For Database variables** (Railway auto-links these):
The CLI should automatically reference the PostgreSQL and Redis you just added.

---

## Step 6: Deploy!

```bash
railway up
```

**What happens:**
- Uploads your code to Railway
- Runs `npm install`
- Runs `npm run build`
- Starts with `npm start`
- Shows deployment logs in real-time
- Takes 3-5 minutes
- You'll see: "Deployment successful!" when done

---

## Step 7: Get Your Backend URL

```bash
railway domain
```

This will generate a public URL like:
`https://routing-dispatch-backend-production-xxxx.up.railway.app`

Copy this URL!

---

## Step 8: Update Vercel Frontend

Go to: https://vercel.com/logandriods-projects/frontend/settings/environment-variables

Update these 3 variables with your new Railway URL:

**VITE_API_URL**
```
https://your-railway-url.up.railway.app
```

**VITE_GRAPHQL_URL**
```
https://your-railway-url.up.railway.app/graphql
```

**VITE_WS_URL**
```
wss://your-railway-url.up.railway.app
```

Click **Save** → Then **Redeploy** Vercel

---

## Step 9: Test Your Backend

Visit in browser:
```
https://your-railway-url.up.railway.app/health
```

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

### "Not logged in"
```bash
railway logout
railway login
```

### "No project linked"
```bash
railway link
# Select your project from the list
```

### Build fails - Missing dependencies
```bash
# Check if package.json exists
ls package.json

# Make sure you're in backend folder
pwd
# Should show: .../my-awesome-project/backend
```

### Database connection errors
The database variables should auto-populate, but if not:

```bash
railway variables
# This shows all variables

# Check if these exist:
# - PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE (from PostgreSQL)
# - REDIS_URL or REDIS_HOST, REDIS_PORT (from Redis)
```

If missing, the databases might not be linked. Try:
```bash
railway add --database postgresql
railway add --database redis
```

### Check deployment status
```bash
railway status
```

Shows current deployment state.

### View logs
```bash
railway logs
```

Shows real-time application logs.

---

## Alternative: Use Railway Dashboard (No CLI)

If CLI doesn't work, here's the web dashboard method:

### 1. In Railway Dashboard
- Click your project
- Click "+ New"
- Select "Empty Service"
- Name it "backend"

### 2. Connect GitHub
- Click the new service
- Settings → Source → "Connect Repo"
- Select `loganmetsker-droid/Routing-`
- Set Root Directory: `backend`
- Save

### 3. Add Databases
- Project view → "+ New" → PostgreSQL
- Project view → "+ New" → Redis

### 4. Set Variables
- Click backend service
- Variables tab
- Add each variable manually OR use Raw Editor

### 5. Deploy
- Should auto-deploy after connecting GitHub
- If not, Settings → "Redeploy Service"

---

## You're Done! 🚀

Your backend is now:
✅ Deployed on Railway
✅ Connected to PostgreSQL
✅ Connected to Redis
✅ Has a public URL
✅ Ready to connect to Vercel frontend

**Next:** Update Vercel environment variables and test!
