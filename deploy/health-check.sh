#!/usr/bin/env bash
###############################################################################
# HBL MRB – Health Check (reviewed & fixed)
# Updated: 2026-04-13 (ports: API=8100, PG=5433, Frontend=3200, Middleware=3202)
###############################################################################
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/MRB_NEW}"
ENV_FILE="$APP_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
    export "$key=$value" 2>/dev/null || true
  done < "$ENV_FILE"
fi

echo "============================================"
echo "  HBL MRB – Health Check"
echo "============================================"
echo ""

ERRORS=0
WARNINGS=0

# 1. Nginx
printf "  %-22s" "Nginx:"
if systemctl is-active --quiet nginx 2>/dev/null; then
  echo "✓ running"
else
  echo "✗ NOT running"; ERRORS=$((ERRORS+1))
fi

# 2. Frontend (port 3200)
printf "  %-22s" "Frontend (3200):"
if curl -sf --max-time 5 http://localhost:3200 >/dev/null 2>&1; then
  echo "✓ responding"
else
  echo "✗ NOT responding"; ERRORS=$((ERRORS+1))
fi

# 3. SAP Middleware (port 3202)
printf "  %-22s" "Middleware (3202):"
if pm2 describe mrb-app 2>/dev/null | grep -q "online"; then
  echo "✓ online"
else
  echo "✗ NOT online"; ERRORS=$((ERRORS+1))
fi

# 4. Scheduler
printf "  %-22s" "Scheduler:"
if pm2 describe mrb-scheduler 2>/dev/null | grep -q "online"; then
  echo "✓ online"
else
  echo "– not running (may use pg_cron)"; WARNINGS=$((WARNINGS+1))
fi

# 5. Database
printf "  %-22s" "Database:"
DB_URL="${SUPABASE_DB_URL:-}"
if [ -n "$DB_URL" ]; then
  if psql "$DB_URL" -c "SELECT 1;" >/dev/null 2>&1; then
    echo "✓ connected"
  else
    echo "✗ connection failed"; ERRORS=$((ERRORS+1))
  fi
else
  echo "– SUPABASE_DB_URL not set"; WARNINGS=$((WARNINGS+1))
fi

# 6. Self-hosted Supabase API Gateway (port 8100)
printf "  %-22s" "Supabase API (8100):"
SUPA_URL="${VITE_SUPABASE_URL:-http://localhost:8100}"
ANON_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-}"
SUPA_HEADERS=""
[ -n "$ANON_KEY" ] && SUPA_HEADERS="-H apikey:$ANON_KEY"
if curl -sf --max-time 5 "$SUPA_URL/rest/v1/" $SUPA_HEADERS >/dev/null 2>&1; then
  echo "✓ responding"
else
  echo "✗ NOT responding"; ERRORS=$((ERRORS+1))
fi

# 7. Disk usage
printf "  %-22s" "Disk usage:"
DISK_PCT=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$DISK_PCT" -lt 85 ]; then
  echo "✓ ${DISK_PCT}% used"
else
  echo "⚠ ${DISK_PCT}% used (getting full)"; WARNINGS=$((WARNINGS+1))
fi

# 8. Stale scheduler locks
printf "  %-22s" "Scheduler locks:"
if [ -n "$DB_URL" ]; then
  STALE=$(psql "$DB_URL" -tAc "SELECT COUNT(*) FROM public.scheduler_lock WHERE expires_at < now();" 2>/dev/null || echo "?")
  STALE=$(echo "$STALE" | tr -d ' ')
  if [ "$STALE" = "0" ]; then
    echo "✓ no stale locks"
  elif [ "$STALE" = "?" ]; then
    echo "– could not check"
  else
    echo "⚠ $STALE stale lock(s)"; WARNINGS=$((WARNINGS+1))
    echo "                        Fix: psql \"\$SUPABASE_DB_URL\" -c \"DELETE FROM scheduler_lock WHERE expires_at < now();\""
  fi
else
  echo "– skipped"
fi

# 9. Departments/Roles configuration
printf "  %-22s" "Roles configured:"
if [ -n "$DB_URL" ]; then
  ROLE_COUNT=$(psql "$DB_URL" -tAc "SELECT COUNT(*) FROM public.departments WHERE is_active = true AND is_workflow_enabled = true;" 2>/dev/null || echo "?")
  ROLE_COUNT=$(echo "$ROLE_COUNT" | tr -d ' ')
  if [ "$ROLE_COUNT" != "?" ] && [ "$ROLE_COUNT" -gt 0 ] 2>/dev/null; then
    echo "✓ $ROLE_COUNT workflow-enabled roles"
  elif [ "$ROLE_COUNT" = "0" ]; then
    echo "⚠ No workflow-enabled roles configured"; WARNINGS=$((WARNINGS+1))
  else
    echo "– could not check"
  fi
else
  echo "– skipped"
fi

# 10. Workflow config
printf "  %-22s" "Workflow config:"
if [ -n "$DB_URL" ]; then
  WF_COUNT=$(psql "$DB_URL" -tAc "SELECT COUNT(DISTINCT plant) FROM public.plant_workflow_config WHERE is_active = true;" 2>/dev/null || echo "?")
  WF_COUNT=$(echo "$WF_COUNT" | tr -d ' ')
  if [ "$WF_COUNT" != "?" ] && [ "$WF_COUNT" -gt 0 ] 2>/dev/null; then
    echo "✓ $WF_COUNT plant(s) configured"
  elif [ "$WF_COUNT" = "0" ]; then
    echo "⚠ No plant workflow configs"; WARNINGS=$((WARNINGS+1))
  else
    echo "– could not check"
  fi
else
  echo "– skipped"
fi

# 11. Docker (self-hosted Supabase)
printf "  %-22s" "Docker:"
if command -v docker &>/dev/null; then
  RUNNING=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -ci "supabase" || echo "0")
  if [ "$RUNNING" -gt 0 ]; then
    echo "✓ $RUNNING Supabase container(s) running"
  else
    echo "⚠ No Supabase containers found"; WARNINGS=$((WARNINGS+1))
  fi
else
  echo "– Docker not installed"
fi

echo ""
echo "────────────────────────────────"
if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
  echo "  ✓ All checks passed"
elif [ "$ERRORS" -eq 0 ]; then
  echo "  ⚠ $WARNINGS warning(s), no critical errors"
else
  echo "  ✗ $ERRORS error(s), $WARNINGS warning(s)"
fi
echo ""
