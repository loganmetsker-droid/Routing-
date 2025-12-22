# Deploy Backend to Vercel (Serverless)

## Quick Setup for Testing

Since you just need the backend working to test the frontend, we'll use Vercel with Supabase's free PostgreSQL.

### Step 1: Create Free Supabase Database

1. Go to: https://supabase.com
2. Click **"Start your project"** → Sign in with GitHub
3. Click **"New project"**
4. Fill in:
   - **Name:** `routing-dispatch`
   - **Database Password:** (create a strong password - save it!)
   - **Region:** Choose closest to you
   - **Plan:** Free (selected by default)
5. Click **"Create new project"**
6. Wait 2-3 minutes for database to provision

### Step 2: Get Database Connection String

1. In your Supabase project, click **"Project Settings"** (gear icon, bottom left)
2. Click **"Database"** in the left sidebar
3. Scroll to **"Connection string"** section
4. Select **"URI"** tab
5. Copy the connection string - it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres
   ```
6. Replace `[YOUR-PASSWORD]` with the password you created
7. Save this URL - you'll need it!

### Step 3: Deploy Backend to Vercel

1. Go to: https://vercel.com
2. You should already be logged in (you deployed frontend here)
3. Click **"Add New..."** → **"Project"**
4. Find your `Routing-` repository
5. Click **"Import"**

### Step 4: Configure Vercel Deployment

**Root Directory:**
- Click **"Edit"** next to Root Directory
- Enter: `backend`
- Click **"Continue"**

**Framework Preset:**
- Select: **"Other"**

**Build Settings:**
- **Build Command:** `npm install --legacy-peer-deps && npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install --legacy-peer-deps`

### Step 5: Add Environment Variables

Click **"Environment Variables"** and add these:

```
NODE_ENV=production
```

```
PORT=3000
```

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxx.supabase.co:5432/postgres
```
(Use the Supabase connection string from Step 2)

```
JWT_SECRET=super-secret-change-this-abc123xyz789
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

### Step 6: Deploy!

1. Click **"Deploy"** button
2. Wait 3-5 minutes for build
3. Watch for **"Deployment Ready"** or **"Visit"** button

### Step 7: Get Your Backend URL

Once deployed:
1. Click **"Visit"** or copy the URL
2. Should be something like: `https://backend-xxx.vercel.app`
3. Test it: visit `https://your-backend-url.vercel.app/health`

### Step 8: Update Frontend

Go to: https://vercel.com/logandriods-projects/frontend/settings/environment-variables

Update these 3 variables:

**VITE_API_URL**
```
https://your-backend-url.vercel.app
```

**VITE_GRAPHQL_URL**
```
https://your-backend-url.vercel.app/graphql
```

**VITE_WS_URL**
```
wss://your-backend-url.vercel.app
```

Click **"Save"** → Go to Deployments → **"Redeploy"**

---

## You're Done! 🎉

Your app should now be fully working:
- ✅ Frontend: https://frontend-seven-mu-49.vercel.app
- ✅ Backend: https://your-backend-url.vercel.app
- ✅ Database: Supabase PostgreSQL (free)

---

## Important Notes

**Vercel Serverless Limitations:**
- Functions have 10s execution timeout (Hobby plan)
- Cold starts (~1-2s delay on first request)
- Great for testing, may need upgrade for production

**Supabase Free Tier:**
- 500MB database
- Perfect for testing
- Unlimited API requests
- Database pauses after 1 week of inactivity (wakes up automatically)

---

## Troubleshooting

**Build Fails:**
- Check build logs in Vercel
- Verify `backend` is set as root directory
- Ensure build command includes `--legacy-peer-deps`

**Database Connection Fails:**
- Verify DATABASE_URL is correct
- Check Supabase project is "Active" (not paused)
- Ensure password in connection string is correct

**CORS Errors:**
- Verify CORS_ORIGIN matches frontend URL exactly
- Redeploy backend after changing environment variables

**Health Endpoint 404:**
- Vercel serverless routes differently
- Try `/api/health` instead of `/health`
