@echo off
REM Railway Deployment Script for Routing Dispatch Backend (Windows)
REM Run this after: railway login

echo 🚂 Starting Railway Deployment...

REM Check if logged in
railway whoami >nul 2>&1
if errorlevel 1 (
    echo ❌ Not logged into Railway. Please run: railway login
    exit /b 1
)

echo ✅ Railway CLI authenticated

REM Link or create project
echo 📦 Linking to Railway project...
railway link || railway init

REM Add PostgreSQL
echo 🐘 Adding PostgreSQL database...
railway add

REM Set environment variables
echo ⚙️ Setting environment variables...
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set CORS_ORIGIN=https://frontend-seven-mu-49.vercel.app
railway variables set JWT_SECRET=change-this-secret-key-in-dashboard
railway variables set JWT_EXPIRES_IN=7d

echo ✅ Environment variables set

REM Deploy
echo 🚀 Deploying to Railway...
railway up

REM Instructions
echo.
echo ✅ Deployment complete!
echo.
echo 📋 Next steps:
echo 1. Get your deployment URL:
echo    railway domain
echo.
echo 2. Run migrations:
echo    railway run npm run typeorm migration:run
echo.
echo 3. Update Vercel frontend environment variables with your Railway URL
echo.
echo 4. Test health endpoint:
echo    curl https://YOUR-RAILWAY-URL.railway.app/health

pause
