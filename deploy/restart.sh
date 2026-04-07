#!/usr/bin/env bash
###############################################################################
# HBL MRB – Restart all services (zero-downtime) (Updated: 2026-04-07)
###############################################################################
set -euo pipefail

echo "============================================"
echo "  HBL MRB – Restarting Services"
echo "============================================"

pm2 describe mrb-app >/dev/null 2>&1 && pm2 restart mrb-app && echo "  ✓ mrb-app restarted" || echo "  – mrb-app not found"
pm2 describe mrb-scheduler >/dev/null 2>&1 && pm2 restart mrb-scheduler && echo "  ✓ mrb-scheduler restarted" || echo "  – mrb-scheduler not found"

sudo systemctl reload nginx && echo "  ✓ Nginx reloaded"

echo ""
pm2 list
echo ""
