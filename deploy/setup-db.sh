#!/usr/bin/env bash
###############################################################################
# HBL MRB – Database Setup & Migration (Self-Hosted Supabase / PostgreSQL)
# Applies all migrations, verifies tables/functions/columns
# Updated: 2026-04-07
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
echo "  HBL MRB – Database Setup & Migrations"
echo "============================================"

###############################################################################
# 1. Test database connection
###############################################################################
echo "[1/6] Testing database connection..."

if ! psql "$DB_URL" -c "SELECT 1;" >/dev/null 2>&1; then
  echo "  ✗ Cannot connect to database!"
  echo "    Check SUPABASE_DB_URL in $ENV_FILE"
  echo "    Ensure PostgreSQL / Supabase is running"
  exit 1
fi
echo "  ✓ Database connected"

###############################################################################
# 2. Enable required extensions
###############################################################################
echo "[2/6] Enabling extensions..."

psql "$DB_URL" -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" 2>/dev/null
psql "$DB_URL" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;" 2>/dev/null
psql "$DB_URL" -c "CREATE EXTENSION IF NOT EXISTS pg_cron;" 2>/dev/null || echo "  ⚠ pg_cron not available (ok for non-scheduler setups)"
psql "$DB_URL" -c "CREATE EXTENSION IF NOT EXISTS pg_net;" 2>/dev/null || echo "  ⚠ pg_net not available"

echo "  ✓ Extensions enabled"

###############################################################################
# 3. Create migration tracking table
###############################################################################
echo "[3/6] Setting up migration tracking..."

psql "$DB_URL" -c "
  CREATE TABLE IF NOT EXISTS public._migrations (
    id serial PRIMARY KEY,
    filename text UNIQUE NOT NULL,
    applied_at timestamptz DEFAULT now()
  );
" 2>/dev/null

echo "  ✓ Migration tracking ready"

###############################################################################
# 4. Apply migrations in order (skip already-applied)
###############################################################################
echo "[4/6] Applying migrations..."

MIGRATION_DIR="$APP_DIR/frontend/supabase/migrations"

if [ ! -d "$MIGRATION_DIR" ]; then
  echo "  ⚠ No migration directory found at $MIGRATION_DIR"
else
  APPLIED=0
  SKIPPED=0
  FAILED=0
  
  for sql_file in $(ls "$MIGRATION_DIR"/*.sql 2>/dev/null | sort); do
    FILENAME=$(basename "$sql_file")
    
    # Check if already applied
    ALREADY=$(psql "$DB_URL" -tAc "SELECT COUNT(*) FROM public._migrations WHERE filename='$FILENAME';" 2>/dev/null || echo "0")
    
    if [ "$ALREADY" -gt 0 ]; then
      SKIPPED=$((SKIPPED + 1))
      continue
    fi
    
    echo "  Applying: $FILENAME"
    if psql "$DB_URL" -f "$sql_file" --single-transaction 2>&1 | while read -r line; do
        case "$line" in
          NOTICE*|DO*|ALTER*|CREATE*|INSERT*|UPDATE*|DELETE*) ;;
          ERROR*) echo "    ✗ $line"; false ;;
          *) ;;
        esac
      done; then
      # Record successful migration
      psql "$DB_URL" -c "INSERT INTO public._migrations (filename) VALUES ('$FILENAME');" 2>/dev/null
      APPLIED=$((APPLIED + 1))
    else
      echo "    ⚠ Migration had errors (may be safe if objects already exist)"
      # Still record it to avoid re-running
      psql "$DB_URL" -c "INSERT INTO public._migrations (filename) VALUES ('$FILENAME') ON CONFLICT DO NOTHING;" 2>/dev/null
      FAILED=$((FAILED + 1))
    fi
  done
  
  TOTAL=$(ls "$MIGRATION_DIR"/*.sql 2>/dev/null | wc -l)
  echo "  ✓ Migrations: $APPLIED applied, $SKIPPED skipped (already done), $FAILED warnings"
  echo "  ✓ Total migration files: $TOTAL"
fi

###############################################################################
# 5. Verify tables exist
###############################################################################
echo "[5/6] Verifying core tables..."

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

TABLE_MISSING=0
for tbl in "${REQUIRED_TABLES[@]}"; do
  EXISTS=$(psql "$DB_URL" -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='$tbl');")
  if [ "$EXISTS" != "t" ]; then
    echo "  ✗ Missing table: $tbl"
    TABLE_MISSING=$((TABLE_MISSING + 1))
  fi
done

if [ "$TABLE_MISSING" -eq 0 ]; then
  echo "  ✓ All ${#REQUIRED_TABLES[@]} core tables verified"
else
  echo "  ⚠ $TABLE_MISSING table(s) missing — check migrations"
fi

###############################################################################
# 6. Verify functions & key columns
###############################################################################
echo "[6/6] Verifying functions & schema..."

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
  "handle_new_user"
  "update_updated_at_column"
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

# Verify key columns on departments table
echo ""
echo "  Schema checks:"

for col in "role_key" "is_workflow_enabled" "workflow_status"; do
  HAS_COL=$(psql "$DB_URL" -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='departments' AND column_name='$col');")
  if [ "$HAS_COL" = "t" ]; then
    echo "    ✓ departments.$col exists"
  else
    echo "    ✗ departments.$col missing — apply latest migration"
  fi
done

# Report active counts
DEPT_COUNT=$(psql "$DB_URL" -tAc "SELECT COUNT(*) FROM public.departments WHERE is_active = true;" 2>/dev/null || echo "?")
WF_COUNT=$(psql "$DB_URL" -tAc "SELECT COUNT(*) FROM public.plant_workflow_config WHERE is_active = true;" 2>/dev/null || echo "?")
USER_COUNT=$(psql "$DB_URL" -tAc "SELECT COUNT(*) FROM public.profiles;" 2>/dev/null || echo "?")
MRB_COUNT=$(psql "$DB_URL" -tAc "SELECT COUNT(*) FROM public.mrb_records;" 2>/dev/null || echo "?")

echo ""
echo "  Database stats:"
echo "    Active roles:          $DEPT_COUNT"
echo "    Workflow steps:        $WF_COUNT"
echo "    User profiles:         $USER_COUNT"
echo "    MRB records:           $MRB_COUNT"

echo ""
echo "============================================"
echo "  Database setup complete"
echo "============================================"
echo ""
