#!/usr/bin/env bash
###############################################################################
# HBL MRB – Create Demo Users via Supabase Auth API
# Run AFTER seed-data.sh: sudo bash deploy/create-users.sh
# Creates users via GoTrue API, assigns roles/plants/security
# Updated: 2026-04-08
###############################################################################
set -euo pipefail

APP_DIR="/opt/MRB"
ENV_FILE="$APP_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi

SUPA_URL="${VITE_SUPABASE_URL:-}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
DB_URL="${SUPABASE_DB_URL:-}"

if [ -z "$SUPA_URL" ] || [ -z "$SERVICE_KEY" ] || [ -z "$DB_URL" ]; then
  echo "ERROR: Missing VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_DB_URL in $ENV_FILE"
  exit 1
fi

DEFAULT_PASSWORD="${DEFAULT_USER_PASSWORD:-Hbl@12345}"
PLANT="1300"

echo "============================================"
echo "  HBL MRB – Create Demo Users"
echo "============================================"
echo "  Supabase: $SUPA_URL"
echo "  Default password: $DEFAULT_PASSWORD"
echo ""

# Define users: email|full_name|role|department
USERS=(
  "masteradmin@sharviinfotech.com|Master Admin|admin|IT"
  "quality.demo@hbl.com|Quality Inspector|quality|Quality"
  "qualityhead.demo@hbl.com|Quality Head|quality_head|Quality"
  "purchase.demo@hbl.com|Purchase Team|purchase|Purchase"
  "purchasehead.demo@hbl.com|Purchase Head|purchase_head|Purchase"
  "engineering.demo@hbl.com|Engineering Team|engineering|Engineering"
  "enghead.demo@hbl.com|Engineering Head|engineering_head|Engineering"
  "executive.demo@hbl.com|Executive Manager|executive|Management"
  "shopfloor.demo@hbl.com|Shop Floor User|shop_floor|Shop Floor"
)

CREATED=0
SKIPPED=0
FAILED=0

for user_entry in "${USERS[@]}"; do
  IFS='|' read -r EMAIL FULL_NAME ROLE DEPARTMENT <<< "$user_entry"

  # Check if user already exists in profiles
  EXISTS=$(psql "$DB_URL" -tAc "SELECT COUNT(*) FROM public.profiles WHERE email='$EMAIL';" 2>/dev/null || echo "0")
  EXISTS=$(echo "$EXISTS" | tr -d ' ')

  if [ "$EXISTS" -gt 0 ]; then
    echo "  ⊘ $EMAIL already exists — skipping"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  echo -n "  Creating $EMAIL ($ROLE)... "

  # Create user via GoTrue Admin API
  RESPONSE=$(curl -sf -X POST \
    "$SUPA_URL/auth/v1/admin/users" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "apikey: $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$EMAIL\",
      \"password\": \"$DEFAULT_PASSWORD\",
      \"email_confirm\": true,
      \"user_metadata\": {
        \"full_name\": \"$FULL_NAME\"
      }
    }" 2>&1) || true

  # Extract user ID from response
  USER_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

  if [ -z "$USER_ID" ]; then
    # Try with node if python fails
    USER_ID=$(echo "$RESPONSE" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).id||'')}catch{console.log('')}})" 2>/dev/null || echo "")
  fi

  if [ -z "$USER_ID" ]; then
    echo "✗ failed"
    echo "    Response: $(echo "$RESPONSE" | head -c 200)"
    FAILED=$((FAILED + 1))
    continue
  fi

  # The handle_new_user trigger should create the profile automatically.
  # Update the profile with department info
  psql "$DB_URL" -c "
    UPDATE public.profiles
    SET department = '$DEPARTMENT', plant = '$PLANT'
    WHERE user_id = '$USER_ID';
  " >/dev/null 2>&1 || true

  # Assign role
  psql "$DB_URL" -c "
    INSERT INTO public.user_roles (user_id, role)
    VALUES ('$USER_ID', '$ROLE')
    ON CONFLICT DO NOTHING;
  " >/dev/null 2>&1

  # Assign plant
  psql "$DB_URL" -c "
    INSERT INTO public.user_plants (user_id, plant_code)
    VALUES ('$USER_ID', '$PLANT')
    ON CONFLICT DO NOTHING;
  " >/dev/null 2>&1

  # Create security record
  psql "$DB_URL" -c "
    INSERT INTO public.user_security (user_id, last_password_change)
    VALUES ('$USER_ID', now())
    ON CONFLICT (user_id) DO NOTHING;
  " >/dev/null 2>&1

  echo "✓ ($USER_ID)"
  CREATED=$((CREATED + 1))
done

echo ""
echo "  ─── Summary ────────────────────────────────"
echo "  Created: $CREATED"
echo "  Skipped: $SKIPPED (already exist)"
echo "  Failed:  $FAILED"
echo ""

# Verify final counts
echo "  ─── Verification ─────────────────────────"
for query in \
  "Profiles|SELECT COUNT(*) FROM public.profiles" \
  "User Roles|SELECT COUNT(*) FROM public.user_roles" \
  "User Plants|SELECT COUNT(*) FROM public.user_plants" \
  "User Security|SELECT COUNT(*) FROM public.user_security"; do
  LABEL="${query%%|*}"
  SQL="${query##*|}"
  COUNT=$(psql "$DB_URL" -tAc "$SQL;" 2>/dev/null || echo "?")
  COUNT=$(echo "$COUNT" | tr -d ' ')
  printf "    %-18s %s\n" "$LABEL:" "$COUNT"
done

echo ""
echo "============================================"
echo "  User creation complete"
echo "============================================"
echo ""
echo "  Login with any user at: http://$(hostname -I 2>/dev/null | awk '{print $1}'):3000"
echo "  Password: $DEFAULT_PASSWORD"
echo ""
echo "  Admin account: masteradmin@sharviinfotech.com"
echo ""
