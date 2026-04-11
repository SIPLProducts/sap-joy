#!/usr/bin/env bash
###############################################################################
# HBL MRB – Update deployment (pull + migrate + rebuild + restart)
# Updated: 2026-04-07
###############################################################################
set -euo pipefail

APP_DIR="/opt/MRB_NEW"
FRONTEND_DIR="$APP_DIR"
ENV_FILE="$APP_DIR/.env"
BACKUP_DIR="$APP_DIR/backups/$(date +%Y%m%d_%H%M%S)"

echo "============================================"
echo "  HBL MRB – Updating Deployment"
echo "============================================"

###############################################################################
# 1. Backup current build
###############################################################################
echo "[1/6] Backing up current build..."
mkdir -p "$BACKUP_DIR"
if [ -d "$FRONTEND_DIR/dist" ]; then
  cp -r "$FRONTEND_DIR/dist" "$BACKUP_DIR/dist"
  echo "  ✓ Backup saved to $BACKUP_DIR"
fi

###############################################################################
# 2. Pull latest code (if git repo)
###############################################################################
echo "[2/6] Updating source..."
cd "$FRONTEND_DIR"
if [ -d ".git" ]; then
  git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || echo "  ⚠ Git pull failed — using existing code"
else
  echo "  – No git repo — copy updated files manually to $FRONTEND_DIR"
fi

###############################################################################
# 3. Update deploy scripts
###############################################################################
echo "[3/6] Updating deploy scripts..."
if [ -d "$FRONTEND_DIR/deploy" ]; then
  cp "$FRONTEND_DIR/deploy/"*.sh "$APP_DIR/scripts/" 2>/dev/null || true
  chmod +x "$APP_DIR/scripts/"*.sh
  echo "  ✓ Deploy scripts updated"
fi

###############################################################################
# 4. Apply database migrations
###############################################################################
echo "[4/6] Applying database migrations..."
bash "$APP_DIR/scripts/setup-db.sh"

###############################################################################
# 5. Rebuild frontend
###############################################################################
echo "[5/6] Rebuilding frontend..."
cp "$ENV_FILE" "$FRONTEND_DIR/.env" 2>/dev/null || true
cd "$FRONTEND_DIR"
npm ci --production=false
npm run build
echo "  ✓ Frontend rebuilt"

###############################################################################
# 6. Deploy edge functions & restart
###############################################################################
echo "[6/6] Deploying edge functions & restarting..."
bash "$APP_DIR/scripts/deploy-edge-functions.sh" 2>/dev/null || echo "  ⚠ Edge function deploy skipped"
bash "$APP_DIR/scripts/restart.sh"

echo ""
echo "============================================"
echo "  Update complete"
echo "============================================"
echo ""
echo "Rollback: cp -r $BACKUP_DIR/dist $FRONTEND_DIR/dist && sudo systemctl reload nginx"
echo ""
