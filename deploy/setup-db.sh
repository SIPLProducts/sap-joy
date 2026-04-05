#!/usr/bin/env bash
###############################################################################
# HBL MRB – Database Setup & Migration (Self-Hosted Supabase / PostgreSQL)
###############################################################################
set -euo pipefail

APP_DIR="/opt/MRB"
ENV_FILE="$APP_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi

DB_URL="${SUPABASE_DB_URL:-}"
if [ -z "$DB_URL" ]; then
  echo "ERROR: SUPABASE_DB_URL not set in $ENV_FILE"
  exit 1
fi

echo "============================================"
echo "  HBL MRB – Database Setup"
echo "============================================"

###############################################################################
# 1. Enable required extensions
###############################################################################
echo "[1/4] Enabling extensions..."

psql "$DB_URL" -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
psql "$DB_URL" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
psql "$DB_URL" -c "CREATE EXTENSION IF NOT EXISTS pg_cron;" 2>/dev/null || echo "  ⚠ pg_cron not available (ok for non-scheduler setups)"
psql "$DB_URL" -c "CREATE EXTENSION IF NOT EXISTS pg_net;" 2>/dev/null || echo "  ⚠ pg_net not available"

echo "  ✓ Extensions enabled"

###############################################################################
# 2. Apply migrations in order
###############################################################################
echo "[2/4] Applying migrations..."

MIGRATION_DIR="$APP_DIR/frontend/supabase/migrations"

if [ -d "$MIGRATION_DIR" ]; then
  MIGRATION_COUNT=0
  for sql_file in $(ls "$MIGRATION_DIR"/*.sql 2>/dev/null | sort); do
    echo "  Applying: $(basename "$sql_file")"
    psql "$DB_URL" -f "$sql_file" --single-transaction 2>&1 | while read -r line; do
      # Suppress notices, show errors
      case "$line" in
        NOTICE*) ;;
        *) echo "    $line" ;;
      esac
    done
    MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
  done
  echo "  ✓ Applied $MIGRATION_COUNT migration(s)"
else
  echo "  ⚠ No migration directory found at $MIGRATION_DIR"
fi

###############################################################################
# 3. Verify tables exist
###############################################################################
echo "[3/4] Verifying core tables..."

REQUIRED_TABLES=(
  "profiles"
  "user_roles"
  "user_plants"
  "user_security"
  "password_history"
  "plants"
  "departments"
  "role_permissions"
  "dashboard_config"
  "plant_workflow_config"
  "plant_print_config"
  "materials"
  "vendors"
  "defect_codes"
  "mrb_records"
  "mrb_approval_history"
  "mrb_attachments"
  "email_logs"
  "email_templates"
  "inward_inspection_lots"
  "shop_floor_stock"
  "sap_api_config"
  "sap_api_request_fields"
  "sap_api_response_fields"
  "sap_stock_sync_history"
  "sap_sync_history"
  "scheduler_lock"
)

MISSING=0
for tbl in "${REQUIRED_TABLES[@]}"; do
  EXISTS=$(psql "$DB_URL" -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='$tbl');")
  if [ "$EXISTS" != "t" ]; then
    echo "  ✗ Missing table: $tbl"
    MISSING=$((MISSING + 1))
  fi
done

if [ "$MISSING" -eq 0 ]; then
  echo "  ✓ All ${#REQUIRED_TABLES[@]} core tables verified"
else
  echo "  ⚠ $MISSING table(s) missing — check migrations"
fi

###############################################################################
# 4. Verify critical functions
###############################################################################
echo "[4/4] Verifying database functions..."

REQUIRED_FUNCS=(
  "has_role"
  "get_user_role"
  "get_user_plant"
  "check_login_security"
  "record_failed_login"
  "reset_failed_login"
  "record_password_change"
  "check_password_reuse"
  "admin_update_user_password"
  "acquire_scheduler_lock"
  "release_scheduler_lock"
  "add_dynamic_column"
  "get_table_columns"
)

FUNC_MISSING=0
for fn in "${REQUIRED_FUNCS[@]}"; do
  EXISTS=$(psql "$DB_URL" -tAc "SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname='$fn' AND pronamespace=(SELECT oid FROM pg_namespace WHERE nspname='public'));")
  if [ "$EXISTS" != "t" ]; then
    echo "  ✗ Missing function: $fn"
    FUNC_MISSING=$((FUNC_MISSING + 1))
  fi
done

if [ "$FUNC_MISSING" -eq 0 ]; then
  echo "  ✓ All ${#REQUIRED_FUNCS[@]} functions verified"
else
  echo "  ⚠ $FUNC_MISSING function(s) missing"
fi

echo ""
echo "============================================"
echo "  Database setup complete"
echo "============================================"
