#!/usr/bin/env bash
###############################################################################
# HBL MRB – Stop all services (Updated: 2026-04-07)
###############################################################################
set -euo pipefail

echo "============================================"
echo "  HBL MRB – Stopping Services"
echo "============================================"

pm2 describe mrb-app >/dev/null 2>&1 && pm2 stop mrb-app && echo "  ✓ mrb-app stopped" || echo "  – mrb-app not running"
pm2 describe mrb-scheduler >/dev/null 2>&1 && pm2 stop mrb-scheduler && echo "  ✓ mrb-scheduler stopped" || echo "  – mrb-scheduler not running"

pm2 save
echo ""
echo "  All services stopped. Nginx remains running."
echo "  To stop Nginx:    sudo systemctl stop nginx"
echo "  To stop Supabase: cd /opt/supabase/docker && docker compose stop"
echo ""
