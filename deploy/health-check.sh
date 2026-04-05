#!/usr/bin/env bash
###############################################################################
# HBL MRB – Health Check
###############################################################################
set -euo pipefail

APP_DIR="/opt/MRB"
ENV_FILE="$APP_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi

echo "============================================"
echo "  HBL MRB – Health Check"
echo "============================================"
echo ""

ERRORS=0

# 1. Nginx
echo -n "  Nginx:              "
if systemctl is-active --quiet nginx; then
  echo "✓ running"
else
  echo "✗ NOT running"; ERRORS=$((ERRORS+1))
fi

# 2. Frontend (port 3000)
echo -n "  Frontend (3000):    "
if curl -sf http://localhost:3000 >/dev/null 2>&1; then
  echo "✓ responding"
else
  echo "✗ NOT responding"; ERRORS=$((ERRORS+1))
fi

# 3. SAP Middleware (port 3002)
echo -n "  Middleware (3002):   "
if pm2 describe mrb-app 2>/dev/null | grep -q "online"; then
  echo "✓ online"
else
  echo "✗ NOT online"; ERRORS=$((ERRORS+1))
fi

# 4. Scheduler
echo -n "  Scheduler:          "
if pm2 describe mrb-scheduler 2>/dev/null | grep -q "online"; then
  echo "✓ online"
else
  echo "– not running (may use pg_cron instead)"
fi

# 5. Database
echo -n "  Database:           "
DB_URL="${SUPABASE_DB_URL:-}"
if [ -n "$DB_URL" ]; then
  if psql "$DB_URL" -c "SELECT 1;" >/dev/null 2>&1; then
    echo "✓ connected"
  else
    echo "✗ connection failed"; ERRORS=$((ERRORS+1))
  fi
else
  echo "– SUPABASE_DB_URL not set"
fi

# 6. Disk usage
echo -n "  Disk usage:         "
DISK_PCT=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$DISK_PCT" -lt 85 ]; then
  echo "✓ ${DISK_PCT}% used"
else
  echo "⚠ ${DISK_PCT}% used (getting full)"; ERRORS=$((ERRORS+1))
fi

# 7. Stale scheduler locks
echo -n "  Scheduler locks:    "
if [ -n "$DB_URL" ]; then
  STALE=$(psql "$DB_URL" -tAc "SELECT COUNT(*) FROM public.scheduler_lock WHERE expires_at < now();" 2>/dev/null || echo "?")
  if [ "$STALE" = "0" ]; then
    echo "✓ no stale locks"
  elif [ "$STALE" = "?" ]; then
    echo "– could not check"
  else
    echo "⚠ $STALE stale lock(s) — run: psql -c \"DELETE FROM scheduler_lock WHERE expires_at < now();\""
  fi
else
  echo "– skipped"
fi

echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo "  ✓ All checks passed"
else
  echo "  ⚠ $ERRORS issue(s) detected"
fi
echo ""
