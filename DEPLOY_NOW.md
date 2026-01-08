# Phase 3 Option B - Quick Start Guide

## 🚀 3-Step Deployment

### 1️⃣ Deploy Backend (Choose One)

**A. Railway Auto-Deploy** (Easiest)
```bash
# Railway should auto-deploy from GitHub
# Check status: railway logs
# If not deploying, configure GitHub integration in Railway dashboard
```

**B. Manual Deploy** (Requires Plan Upgrade)
```bash
cd backend
railway up
```

**C. Alternative: Use Local Backend for Testing**
```bash
cd backend
npm install
npm run build
npm run start:prod
# Backend runs on http://localhost:3000
```

### 2️⃣ Update Frontend Environment (Vercel Dashboard)

Go to: https://vercel.com/logandriods-projects/frontend/settings/environment-variables

**Production Variables**:
```
VITE_API_URL = https://railway-add-production-41ba.up.railway.app
VITE_GRAPHQL_URL = https://railway-add-production-41ba.up.railway.app/graphql
VITE_WS_URL = wss://railway-add-production-41ba.up.railway.app
```

Then redeploy: Click "Deployments" → "..." → "Redeploy"

### 3️⃣ Run Database Migration

**Via Railway CLI**:
```bash
cd backend
railway run psql $DATABASE_URL < migrations/add-job-workflow-fields.sql
```

**Or manually copy/paste SQL** from `backend/migrations/add-job-workflow-fields.sql`

---

## ✅ Quick Verification

**Test Backend**:
```bash
curl https://railway-add-production-41ba.up.railway.app/health
```

**Test Frontend**:
Open: https://frontend-seven-mu-49.vercel.app

**Look For**:
- 7 tabs on Jobs page
- Calendar view with colored jobs
- Billing status toggles
- Customer search

---

## 🎯 What's New in Phase 3

- **Job Lifecycle**: unscheduled → scheduled → in_progress → completed → archived
- **Multi-Day Jobs**: Jobs can span multiple days on calendar
- **Billing Tracking**: Mark jobs paid/unpaid (no payment processing)
- **Customer Reuse**: Search customers and clone past jobs
- **Calendar View**: Month/Week/Day views with FullCalendar
- **New Endpoints**: Clone, billing update, lifecycle update, history

---

## 📋 Test Checklist

- [ ] Backend responds to `/health`
- [ ] GraphQL playground accessible at `/graphql`
- [ ] Frontend loads without errors
- [ ] Jobs tabs all visible
- [ ] Calendar shows jobs with colors
- [ ] Can toggle billing status
- [ ] Customer search works
- [ ] Job cloning works

---

See **PHASE3_DEPLOYMENT_GUIDE.md** for detailed instructions.
