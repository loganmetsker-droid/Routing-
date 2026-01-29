# Render Setup Guide - Step by Step

## 🎯 What We're Setting Up

1. PostgreSQL Database Service
2. Web Service (Backend API)
3. Environment Variables
4. Deployment Configuration

---

## Step 1: Create PostgreSQL Database

### 1.1 Navigate to Render Dashboard
- Go to https://dashboard.render.com
- Click **"New +"** → **"PostgreSQL"**

### 1.2 Configure Database
```
Name: routing-dispatch-db
Database: fleet_management
User: [auto-generated]
Region: [Choose closest to your users]
Plan: Free (or paid if needed)
```

### 1.3 Click "Create Database"
- Wait for status to show **"Available"** (green)
- This takes 1-2 minutes

### 1.4 Copy Database URL
- In the database page, find **"Connections"** section
- Copy the **"Internal Database URL"**
- Format: `postgresql://user:pass@host:5432/dbname`
- ⚠️ **IMPORTANT:** Use "Internal" not "External" URL

---

## Step 2: Create Web Service

### 2.1 Navigate Back to Dashboard
- Click **"New +"** → **"Web Service"**

### 2.2 Connect GitHub Repository
- Click **"Connect account"** if not connected
- Select your repository: `loganmetsker-droid/Routing-`
- Click **"Connect"**

### 2.3 Configure Service Settings

**Basic Settings:**
```
Name: routing-dispatch-backend
Region: [Same as database]
Branch: main
```

**Build & Deploy:**
```
Root Directory: backend
Build Command: npm install && npm run build
Start Command: npm run start:prod
```

**Instance Type:**
```
Plan: Free (or paid)
```

### 2.4 Click "Create Web Service"
- Don't deploy yet! We need to set environment variables first
- Click **"Cancel"** on the auto-deploy dialog

---

## Step 3: Configure Environment Variables

### 3.1 Navigate to Environment Tab
- In your web service page
- Click **"Environment"** in left sidebar

### 3.2 Add Required Variables

Click **"Add Environment Variable"** for each:

#### Required Variables:

**1. DATABASE_URL**
```
Key: DATABASE_URL
Value: [Paste the Internal Database URL from Step 1.4]
```

**2. NODE_ENV**
```
Key: NODE_ENV
Value: production
```

#### Optional Variables (Recommended):

**3. FRONTEND_URL** (for CORS)
```
Key: FRONTEND_URL
Value: https://your-frontend-url.onrender.com
```
*Note: Add this later when you deploy frontend*

**4. JWT_SECRET** (if not auto-generated)
```
Key: JWT_SECRET
Value: [Generate a random string: openssl rand -base64 32]
```

**5. If Using Stripe:**
```
Key: STRIPE_SECRET_KEY
Value: sk_live_... or sk_test_...

Key: STRIPE_WEBHOOK_SECRET
Value: whsec_...
```

### 3.3 Save Changes
- Click **"Save Changes"**
- Render will auto-deploy with new environment variables

---

## Step 4: Verify Configuration

### 4.1 Check Build Logs
- Go to **"Logs"** tab
- Watch for these success messages:
```
[DatabaseConfig] [DB:CONFIG] Using DATABASE_URL: postgresql://****@...
[DatabaseConfig] [DB:CONFIG] Pool size: 3, Retry attempts: 10
[Bootstrap] 🚀 Application running on: http://0.0.0.0:10000
```

### 4.2 Common Issues During Deploy

**Issue: "Connection terminated unexpectedly"**
```
✓ Check: DATABASE_URL is set correctly
✓ Check: PostgreSQL service is "Available"
✓ Check: Using "Internal" not "External" URL
```

**Issue: "No open ports detected"**
```
✓ This means app crashed before binding port
✓ Check logs for actual error (usually database)
✓ Fix database issue, then redeploy
```

**Issue: Build fails with TypeScript errors**
```
✓ Check: Latest code is pushed to GitHub
✓ Try: Clear build cache (Settings → "Clear build cache & deploy")
```

### 4.3 Test Health Endpoint
Once deployed successfully:
```bash
curl https://your-service.onrender.com/health
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

---

## Step 5: Run Database Migrations

### 5.1 Access Shell (if needed)
- In Render Dashboard → Web Service → **"Shell"** tab
- Run:
```bash
npm run migration:run
```

**Or** enable auto-migrations:
- Add environment variable:
```
Key: RUN_MIGRATIONS
Value: true
```
- Update code to read this variable

---

## Step 6: Monitor & Maintain

### 6.1 View Logs
```bash
# Real-time logs in dashboard
Dashboard → Logs tab

# Or use Render CLI
npm install -g @render/cli
render login
render logs routing-dispatch-backend
```

### 6.2 Check Metrics
- Dashboard → Metrics tab
- Monitor:
  - Response times
  - Memory usage
  - CPU usage
  - Database connections

### 6.3 Set Up Alerts (Paid Plans)
- Dashboard → Alerts
- Configure notifications for:
  - Deploy failures
  - Health check failures
  - High error rates

---

## Quick Verification Checklist

Before deploying, verify:

- [ ] PostgreSQL service status is **"Available"** (green)
- [ ] DATABASE_URL is set in web service environment variables
- [ ] DATABASE_URL uses **"Internal"** URL (not External)
- [ ] NODE_ENV is set to `production`
- [ ] Build Command: `npm install && npm run build`
- [ ] Start Command: `npm run start:prod`
- [ ] Root Directory: `backend`

After deploying, verify:

- [ ] Build completes successfully (no TypeScript errors)
- [ ] Logs show: "Application running on: http://0.0.0.0:XXXXX"
- [ ] Health endpoint responds: `curl https://your-url/health`
- [ ] No database connection errors in logs
- [ ] Service status shows **"Live"** (green)

---

## Troubleshooting Commands

### Check if environment variables are set correctly:
```bash
# In Render Shell
echo $DATABASE_URL | head -c 30  # Shows first 30 chars
echo $NODE_ENV
```

### Test database connection:
```bash
# In Render Shell (if psql is available)
psql $DATABASE_URL -c "SELECT version();"
```

### View recent errors:
```bash
# In local terminal with Render CLI
render logs routing-dispatch-backend --tail 100
```

### Force rebuild:
```
Dashboard → Manual Deploy → Clear build cache & deploy
```

---

## Need Help?

1. **Check logs first** - Most issues are visible in logs
2. **Read [DEPLOYMENT_TROUBLESHOOTING.md](DEPLOYMENT_TROUBLESHOOTING.md)** - Comprehensive guide
3. **Verify configuration** - Run verification script
4. **Test locally** - Replicate production settings:
   ```bash
   NODE_ENV=production DATABASE_URL=your_url npm run start:prod
   ```

---

## What's Next?

After backend is deployed:

1. **Deploy Frontend** - Similar process for frontend service
2. **Configure CORS** - Add frontend URL to FRONTEND_URL env var
3. **Set up Custom Domain** - Render Settings → Custom Domain
4. **Enable HTTPS** - Auto-enabled by Render
5. **Monitor Performance** - Use Render metrics dashboard

Your backend API will be available at:
```
https://routing-dispatch-backend.onrender.com
```

API Docs:
```
https://routing-dispatch-backend.onrender.com/api/docs
```

Health Check:
```
https://routing-dispatch-backend.onrender.com/health
```
