# Railway Deployment Guide

## Prerequisites
✅ Railway CLI installed (version 4.23.2)

## Deployment Steps

### 1. Login to Railway
```bash
cd backend
railway login
```
- Opens browser for authentication
- Login with GitHub account

### 2. Initialize/Link Project
```bash
railway link
```
**Choose option:**
- **Create new project**: `routing-dispatch-backend`
- OR link to existing project if you already have one

### 3. Add PostgreSQL Database
```bash
railway add
```
- Select: `PostgreSQL`
- Railway auto-provisions database
- DATABASE_URL environment variable is automatically set

### 4. Add Redis (Optional)
```bash
railway add
```
- Select: `Redis`
- REDIS_URL environment variable is automatically set

### 5. Set Environment Variables
```bash
# Core Configuration
railway variables set NODE_ENV=production
railway variables set PORT=3000

# CORS for Frontend
railway variables set CORS_ORIGIN=https://frontend-seven-mu-49.vercel.app

# JWT Configuration
railway variables set JWT_SECRET=$(openssl rand -base64 32)
railway variables set JWT_EXPIRES_IN=7d

# Database (if not auto-set)
# Railway should auto-set DATABASE_URL when you add PostgreSQL
# Only set manually if needed

# Redis (if added)
# Railway should auto-set REDIS_URL when you add Redis
# Only set manually if needed
```

### 6. Deploy to Railway
```bash
railway up
```
- Builds and deploys backend
- Returns deployment URL (e.g., `https://routing-dispatch-backend-production.up.railway.app`)

### 7. Get Deployment URL
```bash
railway domain
```
Copy the URL (you'll need it for frontend configuration)

### 8. Run Database Migrations
```bash
railway run npm run typeorm migration:run
```

### 9. Seed Test Data (Optional)
```bash
railway run npm run seed
```

## Post-Deployment

### Update Frontend Environment Variables

1. Go to https://vercel.com/logandroids-projects/frontend
2. Settings → Environment Variables
3. Update these variables:
   - `VITE_API_URL` = `https://YOUR-RAILWAY-URL.railway.app/api`
   - `VITE_GRAPHQL_URL` = `https://YOUR-RAILWAY-URL.railway.app/graphql`
   - `VITE_WS_URL` = `wss://YOUR-RAILWAY-URL.railway.app`
4. Redeploy frontend: `Deployments → ... → Redeploy`

## Verify Deployment

Test health endpoint:
```bash
curl https://YOUR-RAILWAY-URL.railway.app/health
```

Expected response:
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-01-13T..."
}
```

## Monitoring

View logs:
```bash
railway logs
```

View deployment status:
```bash
railway status
```

## Troubleshooting

### Issue: Database Connection Failed
```bash
# Check DATABASE_URL is set
railway variables

# If missing, manually set it from Railway dashboard
```

### Issue: Port Already in Use
Railway automatically assigns PORT. Ensure your app uses `process.env.PORT`:
```typescript
// main.ts
const port = process.env.PORT || 3000;
await app.listen(port);
```

### Issue: Build Fails
```bash
# Check build logs
railway logs --build

# Test build locally
npm run build
```

## Cost Estimate
- **PostgreSQL**: ~$5/month (500MB)
- **Backend Deploy**: Free tier (~500 hours/month)
- **Total**: ~$5/month

## Railway Dashboard
Access: https://railway.app/dashboard

## Support
Railway Docs: https://docs.railway.app/
Railway Discord: https://discord.gg/railway
