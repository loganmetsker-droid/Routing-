@echo off
echo ============================================
echo VERCEL DEPLOYMENT STATUS CHECK
echo ============================================
echo.

echo 1. Latest LOCAL commit:
git log --oneline -1
echo.

echo 2. Production bundle hash:
curl -s https://frontend-seven-mu-49.vercel.app/ | findstr /C:"assets/index-" | findstr /R ".js"
echo.

echo 3. Expected bundle hash (from last build):
type frontend\dist\index.html | findstr /C:"assets/index-" | findstr /R ".js"
echo.

echo ============================================
echo TROUBLESHOOTING STEPS:
echo ============================================
echo.
echo If hashes don't match, Vercel hasn't deployed yet.
echo.
echo Option 1: Manual Redeploy via Vercel Dashboard
echo   1. Go to: https://vercel.com/logandroids-projects/frontend
echo   2. Click "Deployments" tab
echo   3. Find the latest deployment
echo   4. Click "..." menu and select "Redeploy"
echo   5. Check "Use existing Build Cache" is OFF
echo   6. Click "Redeploy"
echo.
echo Option 2: Check Vercel GitHub Integration
echo   1. Go to: https://vercel.com/logandroids-projects/frontend/settings/git
echo   2. Verify GitHub repo is connected
echo   3. Verify branch is set to "main"
echo   4. Verify "Production Branch" is "main"
echo.
echo Option 3: Force deployment via Vercel CLI
echo   cd frontend
echo   npx vercel --prod
echo.
pause
