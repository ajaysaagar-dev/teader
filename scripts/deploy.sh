#!/usr/bin/env bash
set -e

echo "=========================================="
echo "   Teader Automated VPS Deployment        "
echo "=========================================="

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "📂 Current Directory: $PROJECT_DIR"

# 1. Pull latest changes from production branch
echo "⬇️  Pulling latest changes from production branch..."
git fetch origin production
git checkout -B production origin/production
git reset --hard origin/production


# 2. Install dependencies
echo "📦 Installing npm dependencies..."
npm install --legacy-peer-deps

# 3. Production Build
echo "⚡ Building Next.js production bundle..."
npm run build

# 4. Zero-Downtime Reload with PM2
if command -v pm2 &> /dev/null; then
  echo "🔄 Reloading PM2 processes..."
  pm2 reload ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production
  pm2 save
  echo "✅ PM2 cluster updated."
else
  echo "⚠️ PM2 not found. Starting with npm start..."
  npm start
fi

echo "=========================================="
echo "   Deployment Complete! App is LIVE.      "
echo "=========================================="
