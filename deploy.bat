@echo off
echo ========================================
echo  Routing & Dispatch SaaS - Deployment
echo ========================================
echo.

REM Check if GitHub remote exists
git remote -v | findstr origin >nul
if %errorlevel% equ 0 (
    echo ✓ Git remote already configured
) else (
    echo.
    echo Please enter your GitHub username:
    set /p GITHUB_USER=Username:
    echo.
    echo Adding GitHub remote...
    git remote add origin https://github.com/!GITHUB_USER!/routing-dispatch-saas.git
)

echo.
echo ========================================
echo  Step 1: Push to GitHub
echo ========================================
echo.
set /p PUSH="Push to GitHub now? (y/n): "
if /i "%PUSH%"=="y" (
    echo Pushing to GitHub...
    git push -u origin main
    echo.
    echo ✓ Code pushed to GitHub!
) else (
    echo Skipped GitHub push
)

echo.
echo ========================================
echo  Step 2: Deploy to Vercel
echo ========================================
echo.
echo Installing Vercel CLI...
call npm install -g vercel

echo.
echo Deploying frontend to Vercel...
cd frontend
call vercel --prod

echo.
echo ========================================
echo  ✓ Deployment Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Configure environment variables in Vercel dashboard
echo 2. Deploy backend to Railway/Render
echo 3. Update frontend env vars with backend URL
echo.
echo See GITHUB_DEPLOYMENT_GUIDE.md for details
echo.
pause
