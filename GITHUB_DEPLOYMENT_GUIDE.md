# GitHub & Vercel Deployment Guide

## ✅ Step 1: Git Repository Created

Your code is now committed to git locally!

**Commit:** `Initial commit: Full-stack Routing & Dispatch SaaS Platform`
**Files:** 197 files committed
**Branch:** main

---

## 📋 Step 2: Create GitHub Repository

### Option A: Using GitHub Website (Recommended)

1. **Go to GitHub:**
   - Visit: https://github.com/new
   - Or click the "+" icon → "New repository"

2. **Repository Settings:**
   ```
   Repository name: routing-dispatch-saas
   Description: Full-stack Routing & Dispatch SaaS Platform with NestJS, React, and OSRM
   Visibility: ○ Public  ● Private (your choice)

   ⚠️ DO NOT initialize with:
   - README
   - .gitignore
   - License

   (We already have these!)
   ```

3. **Click "Create repository"**

4. **You'll see instructions - IGNORE them, use ours below instead**

### Option B: Using GitHub CLI (if you install it)

```bash
# Install GitHub CLI first: https://cli.github.com/
gh auth login
gh repo create routing-dispatch-saas --private --source=. --remote=origin --push
```

---

## 🚀 Step 3: Push to GitHub

Once you've created the repository on GitHub, run these commands:

### Add Remote (replace USERNAME with your GitHub username)
```bash
cd C:/Users/lmets/OneDrive/Desktop/my-awesome-project

# Add your GitHub repo as remote
git remote add origin https://github.com/USERNAME/routing-dispatch-saas.git

# Or if using SSH:
# git remote add origin git@github.com:USERNAME/routing-dispatch-saas.git

# Push to GitHub
git push -u origin main
```

### Verify Push
```bash
git remote -v
# Should show:
# origin  https://github.com/USERNAME/routing-dispatch-saas.git (fetch)
# origin  https://github.com/USERNAME/routing-dispatch-saas.git (push)
```

---

## 🎯 Step 4: Deploy Frontend to Vercel

### Install Vercel CLI
```bash
npm install -g vercel
```

### Deploy Frontend

```bash
cd C:/Users/lmets/OneDrive/Desktop/my-awesome-project

# Login to Vercel
vercel login

# Deploy (will ask configuration questions)
vercel
```

### Vercel Setup Questions

When prompted:

1. **Set up and deploy "my-awesome-project"?** → `Y`

2. **Which scope?** → Select your account

3. **Link to existing project?** → `N`

4. **What's your project's name?** → `routing-dispatch-saas`

5. **In which directory is your code located?** → `./frontend`

6. **Want to override the settings?** → `Y`

7. **Build Command:** → `npm run build`

8. **Output Directory:** → `dist`

9. **Development Command:** → `npm run dev`

10. **Install Command:** → `npm install`

### Important: Environment Variables

After first deployment, add environment variables in Vercel:

1. Go to: https://vercel.com/your-username/routing-dispatch-saas/settings/environment-variables

2. Add these variables:
   ```
   VITE_API_URL=your-backend-url
   VITE_GRAPHQL_URL=your-backend-url/graphql
   VITE_WS_URL=ws://your-backend-url
   ```

3. Redeploy:
   ```bash
   vercel --prod
   ```

---

## 🔧 Backend Deployment Options

### Option 1: Railway (Easiest for Full Stack)
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Option 2: Render.com
1. Go to https://render.com
2. Connect GitHub repo
3. Create "Web Service"
4. Set:
   - Build Command: `cd backend && npm install && npm run build`
   - Start Command: `cd backend && npm run start:prod`
   - Add environment variables from `.env.example`

### Option 3: Heroku
```bash
heroku login
heroku create routing-dispatch-backend
git subtree push --prefix backend heroku main
```

### Option 4: AWS/GCP/Azure
- Use Docker Compose from `docker-compose.yml`
- Deploy to ECS, Cloud Run, or Azure Container Instances

---

## 📝 Post-Deployment Checklist

### Frontend (Vercel)
- ✅ Site deployed and accessible
- ✅ Environment variables configured
- ✅ Custom domain added (optional)
- ✅ Auto-deploy from GitHub enabled

### Backend
- ✅ API accessible
- ✅ Database connected
- ✅ Environment variables set
- ✅ CORS configured for frontend URL

### Database
- ✅ PostgreSQL instance running
- ✅ TimescaleDB extension enabled
- ✅ Migrations run
- ✅ Backup configured

### Services
- ✅ Redis cache accessible
- ✅ OSRM routing service (optional for production)

---

## 🎉 Quick Deploy Commands

```bash
# From project root
cd C:/Users/lmets/OneDrive/Desktop/my-awesome-project

# 1. Push to GitHub (after creating repo)
git remote add origin https://github.com/YOUR_USERNAME/routing-dispatch-saas.git
git push -u origin main

# 2. Deploy Frontend to Vercel
cd frontend
vercel --prod

# 3. Deploy Backend (example with Railway)
railway login
railway init
railway up

# Done!
```

---

## 🔗 Useful Links

- **Vercel Dashboard:** https://vercel.com/dashboard
- **Vercel Docs:** https://vercel.com/docs
- **Railway:** https://railway.app
- **Render:** https://render.com
- **GitHub:** https://github.com

---

## 💡 Tips

1. **Environment Variables:**
   - Never commit `.env` to git (already in .gitignore)
   - Use `.env.example` as template
   - Set all vars in deployment platform

2. **Database:**
   - Use managed PostgreSQL (Railway, Render, Supabase)
   - Enable TimescaleDB extension
   - Run migrations on first deploy

3. **OSRM Service:**
   - For production, use hosted OSRM or Mapbox/Google APIs
   - Self-hosting OSRM requires significant resources
   - Consider using cloud provider's routing API

4. **Monitoring:**
   - Enable Vercel Analytics
   - Add Sentry for error tracking
   - Use Prometheus + Grafana for metrics

---

## ⚠️ Before Production

- [ ] Change all default passwords
- [ ] Use strong JWT secrets
- [ ] Enable HTTPS only
- [ ] Set up proper CORS
- [ ] Add rate limiting
- [ ] Configure backups
- [ ] Set up monitoring/alerting
- [ ] Add CI/CD pipeline
- [ ] Security audit
- [ ] Load testing

---

## 🆘 Troubleshooting

**Build Fails:**
- Check Node version (need 18+)
- Verify all dependencies in package.json
- Check build logs for specific errors

**Environment Variables Not Working:**
- Prefix with `VITE_` for frontend
- Redeploy after adding vars
- Check spelling/capitalization

**CORS Errors:**
- Add frontend URL to backend CORS_ORIGIN
- Include credentials: true
- Check protocol (http vs https)

**Database Connection:**
- Use DATABASE_URL format: `postgresql://user:pass@host:5432/db`
- Enable SSL for production
- Check firewall rules

---

## 📊 Expected Costs (Monthly)

**Free Tier:**
- Vercel: Free (hobby plan)
- Railway: $5 credit/month
- Render: Free tier available
- **Total: $0-10/month**

**Production:**
- Vercel Pro: $20
- Database (Railway/Render): $10-30
- Redis: $10-15
- **Total: $40-65/month**

---

Your application is ready to deploy! 🚀

Follow the steps above and you'll have a live production app in minutes.
