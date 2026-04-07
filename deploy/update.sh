#!/usr/bin/env bash
###############################################################################
# HBL MRB – Update deployment (rebuild frontend + apply migrations + restart)
# Updated: 2026-04-07
###############################################################################
set -euo pipefail

APP_DIR="/opt/MRB"
FRONTEND_DIR="$APP_DIR/frontend"
ENV_FILE="$APP_DIR/.env"
BACKUP_DIR="$APP_DIR/backups/$(date +%Y%m%d_%H%M%S)"

echo "============================================"
echo "  HBL MRB – Updating Deployment"
echo "============================================"

###############################################################################
# 1. Backup current build
###############################################################################
echo "[1/5] Backing up current build..."
mkdir -p "$BACKUP_DIR"
if [ -d "$FRONTEND_DIR/dist" ]; then
  cp -r "$FRONTEND_DIR/dist" "$BACKUP_DIR/dist"
  echo "  ✓ Backup saved to $BACKUP_DIR"
fi

###############################################################################
# 2. Pull latest code (if git repo)
###############################################################################
echo "[2/5] Updating source..."
cd "$FRONTEND_DIR"
if [ -d ".git" ]; then
  git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || echo "  ⚠ Git pull failed — using existing code"
else
  echo "  – No git repo — copy updated files manually to $FRONTEND_DIR"
fi

###############################################################################
# 3. Apply database migrations (if any new ones)
###############################################################################
echo "[3/5] Applying database migrations..."
if [ -f "$APP_DIR/scripts/setup-db.sh" ]; then
  bash "$APP_DIR/scripts/setup-db.sh"
elif [ -f "$FRONTEND_DIR/deploy/setup-db.sh" ]; then
  bash "$FRONTEND_DIR/deploy/setup-db.sh"
else
  echo "  ⚠ setup-db.sh not found — skipping migrations"
fi

###############################################################################
# 4. Rebuild frontend
###############################################################################
echo "[4/5] Rebuilding frontend..."
cp "$ENV_FILE" "$FRONTEND_DIR/.env" 2>/dev/null || true
npm ci --production=false
npm run build
echo "  ✓ Frontend rebuilt"

###############################################################################
# 5. Restart services
###############################################################################
echo "[5/5] Restarting services..."
bash "$(dirname "$0")/restart.sh"

echo ""
echo "============================================"
echo "  Update complete"
echo "============================================"
echo ""
echo "Rollback: cp -r $BACKUP_DIR/dist $FRONTEND_DIR/dist && sudo systemctl reload nginx"
echo ""
