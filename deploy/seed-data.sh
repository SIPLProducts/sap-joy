#!/usr/bin/env bash
###############################################################################
# HBL MRB – Seed Configuration Data (Plants, Departments, SAP API Config)
# Run after setup-db.sh: sudo bash deploy/seed-data.sh
# Updated: 2026-04-08
###############################################################################
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/MRB_NEW}"
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
echo "  HBL MRB – Seeding Configuration Data"
echo "============================================"

# Find seed SQL file (check multiple locations)
SEED_FILE=""
for path in \
  "$APP_DIR/frontend/deploy/seed-data.sql" \
  "$APP_DIR/scripts/seed-data.sql" \
  "$(dirname "$0")/seed-data.sql"; do
  if [ -f "$path" ]; then
    SEED_FILE="$path"
    break
  fi
done

if [ -z "$SEED_FILE" ]; then
  echo "  ✗ seed-data.sql not found!"
  echo "    Expected at: $APP_DIR/frontend/deploy/seed-data.sql"
  exit 1
fi

echo "  Using: $SEED_FILE"

# Wait for database
echo "  Checking database connection..."
for i in $(seq 1 15); do
  if psql "$DB_URL" -c "SELECT 1;" >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 15 ]; then
    echo "  ✗ Cannot connect to database!"
    exit 1
  fi
  sleep 2
done

# Apply seed data
echo "  Applying seed data..."
OUTPUT=$(psql "$DB_URL" -f "$SEED_FILE" 2>&1) || true

if echo "$OUTPUT" | grep -qi "^ERROR"; then
  echo "  ⚠ Some errors occurred (may be safe if data already exists):"
  echo "$OUTPUT" | grep -i "^ERROR" | head -5
else
  echo "  ✓ Seed data applied successfully"
fi

# Verify counts
echo ""
echo "  Verification:"
for query in \
  "Plants|SELECT COUNT(*) FROM public.plants" \
  "Departments|SELECT COUNT(*) FROM public.departments" \
  "Workflow Steps|SELECT COUNT(*) FROM public.plant_workflow_config WHERE plant='1300'" \
  "Print Configs|SELECT COUNT(*) FROM public.plant_print_config" \
  "SAP API Configs|SELECT COUNT(*) FROM public.sap_api_config" \
  "SAP Request Fields|SELECT COUNT(*) FROM public.sap_api_request_fields" \
  "SAP Response Fields|SELECT COUNT(*) FROM public.sap_api_response_fields"; do
  LABEL="${query%%|*}"
  SQL="${query##*|}"
  COUNT=$(psql "$DB_URL" -tAc "$SQL;" 2>/dev/null || echo "?")
  COUNT=$(echo "$COUNT" | tr -d ' ')
  printf "    %-22s %s\n" "$LABEL:" "$COUNT"
done

echo ""
echo "============================================"
echo "  Seed data complete"
echo "============================================"
echo ""
