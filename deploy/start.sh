#!/usr/bin/env bash
###############################################################################
# HBL MRB – Start all services via PM2
# Updated: 2026-04-13 (ports: Middleware=3202, Supabase=8100)
###############################################################################
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/MRB_NEW}"
BACKEND_DIR="$APP_DIR/sap-proxy/mrb-backend"
LOG_DIR="/var/log/mrb"
ENV_FILE="$APP_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
    export "$key=$value" 2>/dev/null || true
  done < "$ENV_FILE"
fi

echo "============================================"
echo "  HBL MRB – Starting Services"
echo "============================================"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

###############################################################################
# 0. Pre-check: Verify self-hosted Supabase is reachable
###############################################################################
SUPA_URL="${VITE_SUPABASE_URL:-}"
echo "[0/2] Checking Supabase connectivity..."

if [ -n "$SUPA_URL" ]; then
  ANON_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-}"
  HEADERS=""
  if [ -n "$ANON_KEY" ]; then
    HEADERS="-H apikey:$ANON_KEY"
  fi
  
  if curl -sf --max-time 5 "$SUPA_URL/rest/v1/" $HEADERS >/dev/null 2>&1; then
    echo "  ✓ Supabase API reachable at $SUPA_URL"
  else
    echo "  ⚠ Supabase API not reachable at $SUPA_URL"
    echo "    Make sure self-hosted Supabase (Docker) is running!"
    echo "    Continuing anyway..."
  fi
else
  echo "  ⚠ VITE_SUPABASE_URL not set — skipping check"
fi

###############################################################################
# 1. SAP Proxy Middleware (port 3202)
###############################################################################
if [ -f "$BACKEND_DIR/server.js" ] || [ -f "$BACKEND_DIR/index.js" ]; then
  ENTRY="index.js"
  [ -f "$BACKEND_DIR/server.js" ] && ENTRY="server.js"
  
  echo "[1/2] Starting SAP Proxy Middleware..."
  pm2 describe mrb-app >/dev/null 2>&1 && pm2 delete mrb-app 2>/dev/null
  pm2 start "$BACKEND_DIR/$ENTRY" \
    --name mrb-app \
    --cwd "$BACKEND_DIR" \
    --log "$LOG_DIR/middleware.log" \
    --time \
    --env production \
    --max-restarts 10 \
    --restart-delay 5000
  echo "  ✓ mrb-app started on port ${SAP_PROXY_PORT:-3202}"
else
  echo "[1/2] ⚠ No middleware entry point found at $BACKEND_DIR — skipping"
fi

###############################################################################
# 2. Deno Scheduler (port 3100)
###############################################################################
SCHED_FILE="$APP_DIR/supabase/functions/sap-sync-scheduler/index.ts"
if [ -f "$SCHED_FILE" ]; then
  echo "[2/2] Starting Deno Scheduler..."
  pm2 describe mrb-scheduler >/dev/null 2>&1 && pm2 delete mrb-scheduler 2>/dev/null

  SUPABASE_URL="${SUPABASE_URL:-$VITE_SUPABASE_URL}" \
  SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}" \
  pm2 start "$SCHED_FILE" \
    --name mrb-scheduler \
    --interpreter deno \
    --interpreter-args "run --allow-net --allow-env --allow-read" \
    --log "$LOG_DIR/scheduler.log" \
    --time \
    --env production \
    --max-restarts 10 \
    --restart-delay 10000 \
    --cron-restart "0 */6 * * *"
  echo "  ✓ Deno scheduler started on port ${SCHEDULER_PORT:-3100}"
else
  echo "[2/2] ⚠ Scheduler not found at $SCHED_FILE"
fi

###############################################################################
# Save PM2 list for auto-restart on reboot
###############################################################################
pm2 save 2>/dev/null || true
echo ""
echo "  ✓ PM2 process list saved"

###############################################################################
# Status
###############################################################################
echo ""
pm2 list 2>/dev/null || true
echo ""
echo "============================================"
echo "  All services started"
echo "============================================"
echo ""
echo "Logs:"
echo "  Middleware:  pm2 logs mrb-app"
echo "  Scheduler:   pm2 logs mrb-scheduler"
echo "  Nginx:       /var/log/nginx/access.log"
echo ""
