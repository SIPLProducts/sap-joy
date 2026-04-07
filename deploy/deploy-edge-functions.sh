#!/usr/bin/env bash
###############################################################################
# HBL MRB – Deploy Edge Functions to Self-Hosted Supabase
# Run as root or with sudo: sudo bash deploy/deploy-edge-functions.sh
# Updated: 2026-04-07 (reviewed & fixed)
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
  echo "  ⚠ Edge functions directory not found at $FUNCTIONS_SRC"
  echo "  Skipping edge function deployment."
  exit 0
fi

###############################################################################
# 1. List available functions
###############################################################################
echo "[1/4] Discovering edge functions..."

FUNCTIONS=()
for func_dir in "$FUNCTIONS_SRC"/*/; do
  [ -d "$func_dir" ] || continue
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

# Determine the correct functions volume path
FUNC_VOLUME_DIR="$SUPABASE_DIR/volumes/functions"
mkdir -p "$FUNC_VOLUME_DIR"

for func_name in "${FUNCTIONS[@]}"; do
  mkdir -p "$FUNC_VOLUME_DIR/$func_name"
  cp "$FUNCTIONS_SRC/$func_name/index.ts" "$FUNC_VOLUME_DIR/$func_name/index.ts"
  # Copy any additional files in the function directory
  for extra_file in "$FUNCTIONS_SRC/$func_name"/*; do
    [ -f "$extra_file" ] || continue
    cp "$extra_file" "$FUNC_VOLUME_DIR/$func_name/"
  done
  echo "  Copied: $func_name/"
done

echo "  ✓ Functions copied"

###############################################################################
# 3. Create/update the main router (self-hosted edge runtime)
###############################################################################
echo "[3/4] Creating main router for edge runtime..."

MAIN_DIR="$FUNC_VOLUME_DIR/main"
mkdir -p "$MAIN_DIR"

# Build the available functions list for the 404 response
AVAILABLE_LIST=$(printf '"%s", ' "${FUNCTIONS[@]}" | sed 's/, $//')

# Generate router using Python for clean output (no escaping issues)
python3 - "$MAIN_DIR/index.ts" "${FUNCTIONS[@]}" <<'PYSCRIPT'
import sys, datetime

output_file = sys.argv[1]
functions = sys.argv[2:]

cases = ""
for fn in functions:
    cases += f"""
    case '/{fn}':
    case '/functions/v1/{fn}': {{
      const mod = await import('../{fn}/index.ts');
      return mod.default ? mod.default(req) : new Response('Function loaded but no default export', {{ status: 500 }});
    }}"""

available = ", ".join(f'"{fn}"' for fn in functions)
date_str = datetime.date.today().isoformat()

content = f'''// Auto-generated main router for self-hosted Supabase Edge Functions
// Generated: {date_str}
// Functions: {", ".join(functions)}

const corsHeaders = {{
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-proxy-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}};

Deno.serve(async (req: Request) => {{
  const url = new URL(req.url);
  const path = url.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {{
    return new Response('ok', {{ headers: corsHeaders }});
  }}

  try {{
    // Extract function name from path
    const funcPath = path.replace(/^\\/functions\\/v1/, '').replace(/\\/$/, '') || '/';
    
    switch (funcPath) {{{cases}
      default:
        return new Response(
          JSON.stringify({{ 
            error: 'Function not found', 
            path: funcPath,
            available: [{available}]
          }}),
          {{ status: 404, headers: {{ ...corsHeaders, 'Content-Type': 'application/json' }} }}
        );
    }}
  }} catch (error) {{
    console.error('Router error:', error);
    return new Response(
      JSON.stringify({{ error: error.message }}),
      {{ status: 500, headers: {{ ...corsHeaders, 'Content-Type': 'application/json' }} }}
    );
  }}
}});
'''

with open(output_file, 'w') as f:
    f.write(content)

print(f"  ✓ Main router created with {len(functions)} routes")
PYSCRIPT

###############################################################################
# 4. Restart edge function container
###############################################################################
echo "[4/4] Restarting edge functions container..."

if [ ! -d "$SUPABASE_DIR" ]; then
  echo "  ⚠ Supabase directory not found at $SUPABASE_DIR"
  echo "    Edge functions copied but container not restarted"
  exit 0
fi

cd "$SUPABASE_DIR"

if docker compose ps 2>/dev/null | grep -q "functions"; then
  docker compose restart functions
  echo "  ✓ Functions container restarted"
  
  # Wait for container to be ready
  sleep 5
else
  echo "  ⚠ Functions container not found — start Supabase first"
  echo "    Run: cd $SUPABASE_DIR && docker compose up -d"
  exit 0
fi

# Test endpoints if we have the anon key
SUPA_URL="${VITE_SUPABASE_URL:-http://localhost:8000}"
ANON_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-}"

if [ -n "$ANON_KEY" ]; then
  echo ""
  echo "  Testing function endpoints..."
  for func_name in "${FUNCTIONS[@]}"; do
    STATUS=$(curl -sf -o /dev/null -w "%{http_code}" \
      --max-time 10 \
      "$SUPA_URL/functions/v1/$func_name" \
      -H "Authorization: Bearer $ANON_KEY" \
      -H "Content-Type: application/json" \
      -X POST -d '{"test": true}' 2>/dev/null || echo "000")
    if [ "$STATUS" = "000" ]; then
      echo "    $func_name: ⚠ unreachable (timeout or connection refused)"
    elif [ "$STATUS" -lt 500 ]; then
      echo "    $func_name: ✓ responding (HTTP $STATUS)"
    else
      echo "    $func_name: ⚠ server error (HTTP $STATUS)"
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
  echo "    - ${SUPA_URL}/functions/v1/$func_name"
done
echo ""
