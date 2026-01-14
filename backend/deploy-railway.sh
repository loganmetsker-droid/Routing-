#!/bin/bash

# Railway Deployment Script for Routing Dispatch Backend
# Run this after: railway login

set -e

echo "🚂 Starting Railway Deployment..."

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo "❌ Not logged into Railway. Please run: railway login"
    exit 1
fi

echo "✅ Railway CLI authenticated"

# Link or create project
echo "📦 Linking to Railway project..."
railway link || railway init

# Add PostgreSQL if not exists
echo "🐘 Adding PostgreSQL database..."
railway add --database postgres || echo "PostgreSQL already added"

# Set environment variables
echo "⚙️  Setting environment variables..."
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set CORS_ORIGIN=https://frontend-seven-mu-49.vercel.app
railway variables set JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "your-secret-key-change-in-dashboard")
railway variables set JWT_EXPIRES_IN=7d

echo "✅ Environment variables set"

# Deploy
echo "🚀 Deploying to Railway..."
railway up

# Get deployment URL
echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Get your deployment URL:"
echo "   railway domain"
echo ""
echo "2. Run migrations:"
echo "   railway run npm run typeorm migration:run"
echo ""
echo "3. Update Vercel frontend environment variables with your Railway URL"
echo ""
echo "4. Test health endpoint:"
echo "   curl https://YOUR-RAILWAY-URL.railway.app/health"
