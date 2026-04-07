#!/usr/bin/env bash
###############################################################################
# HBL MRB – Deploy Edge Functions to Self-Hosted Supabase
# Run as root or with sudo: sudo bash deploy/deploy-edge-functions.sh
# Updated: 2026-04-07
###############################################################################
set -euo pipefail

APP_DIR="/opt/MRB"
FRONTEND_DIR="$APP_DIR/frontend"
SUPABASE_DIR="/opt/supabase/docker"
ENV_FILE="$APP_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi

echo "============================================"
echo "  HBL MRB – Edge Function Deployment"
echo "============================================"

FUNCTIONS_SRC="$FRONTEND_DIR/supabase/functions"

if [ ! -d "$FUNCTIONS_SRC" ]; then
  echo "ERROR: Edge functions directory not found at $FUNCTIONS_SRC"
  exit 1
fi

###############################################################################
# 1. List available functions
###############################################################################
echo "[1/4] Discovering edge functions..."

FUNCTIONS=()
for func_dir in "$FUNCTIONS_SRC"/*/; do
  if [ -f "$func_dir/index.ts" ]; then
    func_name=$(basename "$func_dir")
    FUNCTIONS+=("$func_name")
    echo "  Found: $func_name"
  fi
done

if [ ${#FUNCTIONS[@]} -eq 0 ]; then
  echo "  ⚠ No edge functions found"
  exit 0
fi

echo "  ✓ ${#FUNCTIONS[@]} function(s) discovered"

###############################################################################
# 2. Copy functions to Supabase volumes directory
###############################################################################
echo "[2/4] Copying functions to Supabase..."

# Find the functions volume mount path
FUNC_VOLUME_DIR="$SUPABASE_DIR/volumes/functions"
mkdir -p "$FUNC_VOLUME_DIR"

for func_name in "${FUNCTIONS[@]}"; do
  mkdir -p "$FUNC_VOLUME_DIR/$func_name"
  cp "$FUNCTIONS_SRC/$func_name/index.ts" "$FUNC_VOLUME_DIR/$func_name/index.ts"
  echo "  Copied: $func_name/index.ts"
done

echo "  ✓ Functions copied"

###############################################################################
# 3. Create/update the main router (self-hosted edge runtime)
###############################################################################
echo "[3/4] Creating main router for edge runtime..."

MAIN_DIR="$FUNC_VOLUME_DIR/main"
mkdir -p "$MAIN_DIR"

# Build dynamic import map
IMPORT_CASES=""
for func_name in "${FUNCTIONS[@]}"; do
  IMPORT_CASES+="
    case '/$func_name':
    case '/functions/v1/$func_name': {
      const mod = await import('../$func_name/index.ts');
      return mod.default ? mod.default(req) : new Response('Function loaded but no default export', { status: 500 });
    }"
done

cat > "$MAIN_DIR/index.ts" <<ROUTER
// Auto-generated main router for self-hosted Supabase Edge Functions
// Generated: $(date +%Y-%m-%d)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-proxy-secret',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      },
    });
  }

  try {
    // Extract function name from path
    const funcPath = path.replace(/^\\/functions\\/v1/, '').replace(/\\/$/, '') || '/';
    
    switch (funcPath) {$IMPORT_CASES
      default:
        return new Response(
          JSON.stringify({ 
            error: 'Function not found', 
            path: funcPath,
            available: [$(printf '"%s", ' "${FUNCTIONS[@]}" | sed 's/, $//')]
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Router error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
ROUTER

echo "  ✓ Main router created with ${#FUNCTIONS[@]} routes"

###############################################################################
# 4. Restart edge function container
###############################################################################
echo "[4/4] Restarting edge functions container..."

cd "$SUPABASE_DIR"

if docker compose ps functions 2>/dev/null | grep -q "Up\|running"; then
  docker compose restart functions
  echo "  ✓ Functions container restarted"
else
  echo "  ⚠ Functions container not running — start Supabase first"
  echo "    Run: cd $SUPABASE_DIR && docker compose up -d"
fi

# Wait and verify
sleep 5
SUPA_URL="${VITE_SUPABASE_URL:-http://localhost:8000}"
ANON_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-}"

if [ -n "$ANON_KEY" ]; then
  echo ""
  echo "  Testing function endpoints..."
  for func_name in "${FUNCTIONS[@]}"; do
    STATUS=$(curl -sf -o /dev/null -w "%{http_code}" \
      "$SUPA_URL/functions/v1/$func_name" \
      -H "Authorization: Bearer $ANON_KEY" \
      -H "Content-Type: application/json" \
      -X POST -d '{"test": true}' 2>/dev/null || echo "000")
    if [ "$STATUS" = "000" ]; then
      echo "    $func_name: ⚠ unreachable"
    elif [ "$STATUS" -lt 500 ]; then
      echo "    $func_name: ✓ responding ($STATUS)"
    else
      echo "    $func_name: ⚠ error ($STATUS)"
    fi
  done
fi

echo ""
echo "============================================"
echo "  Edge functions deployed"
echo "============================================"
echo ""
echo "  Functions dir: $FUNC_VOLUME_DIR"
echo "  Available functions:"
for func_name in "${FUNCTIONS[@]}"; do
  echo "    - $SUPA_URL/functions/v1/$func_name"
done
echo ""
