#!/usr/bin/env bash
###############################################################################
# HBL MRB – Setup PM2 auto-start on boot + scheduler lock cleanup cron
# Updated: 2026-04-07
###############################################################################
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/MRB_NEW}"
ENV_FILE="$APP_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi

echo "============================================"
echo "  HBL MRB – Scheduler & Boot Setup"
echo "============================================"

###############################################################################
# 1. PM2 auto-start on boot
###############################################################################
echo "[1/3] Configuring PM2 startup..."

pm2 startup systemd -u iml --hp /home/iml 2>/dev/null || pm2 startup
pm2 save
echo "  ✓ PM2 will auto-start on boot"

###############################################################################
# 2. Cron: stale lock cleanup (every 15 min)
###############################################################################
echo "[2/3] Setting up stale lock cleanup cron..."

DB_URL="${SUPABASE_DB_URL:-}"
if [ -n "$DB_URL" ]; then
  CRON_CMD="*/15 * * * * psql \"$DB_URL\" -c \"DELETE FROM public.scheduler_lock WHERE expires_at < now();\" >> /var/log/mrb/lock-cleanup.log 2>&1"
  
  # Remove old entry if exists, then add new
  crontab -l -u iml 2>/dev/null | grep -v 'scheduler_lock' | { cat; echo "$CRON_CMD"; } | crontab -u iml -
  echo "  ✓ Lock cleanup cron installed for user iml"
else
  echo "  ⚠ SUPABASE_DB_URL not set — skipping cron"
fi

###############################################################################
# 3. Cron: DB-level pg_cron setup (for cloud-mode scheduler)
###############################################################################
echo "[3/3] Setting up pg_cron job (if pg_cron available)..."

if [ -n "$DB_URL" ]; then
  ANON_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-}"
  SUPA_URL="${VITE_SUPABASE_URL:-}"
  
  if [ -n "$ANON_KEY" ] && [ -n "$SUPA_URL" ]; then
    psql "$DB_URL" -c "
      SELECT cron.schedule(
        'mrb-sap-sync-scheduler',
        '*/5 * * * *',
        \$\$
        SELECT net.http_post(
          url := '${SUPA_URL}/functions/v1/sap-sync-scheduler',
          headers := '{\"Content-Type\": \"application/json\", \"Authorization\": \"Bearer ${ANON_KEY}\"}'::jsonb,
          body := '{\"source\": \"pg_cron\"}'::jsonb
        ) AS request_id;
        \$\$
      );
    " 2>/dev/null && echo "  ✓ pg_cron job created" || echo "  ⚠ pg_cron not available — standalone scheduler will handle this"
  else
    echo "  ⚠ Missing ANON_KEY or SUPABASE_URL — skipping pg_cron"
  fi
fi

echo ""
echo "============================================"
echo "  Scheduler setup complete"
echo "============================================"
echo ""
echo "Verify:"
echo "  crontab -l -u iml     # View cron jobs"
echo "  pm2 list               # View running processes"
echo "  pm2 logs mrb-scheduler # View scheduler logs"
echo ""
