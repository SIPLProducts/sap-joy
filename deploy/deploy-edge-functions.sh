#!/usr/bin/env bash
###############################################################################
# HBL MRB – Deploy Edge Functions to Self-Hosted Supabase
# Run as root or with sudo: sudo bash deploy/deploy-edge-functions.sh
# Updated: 2026-04-10 (handler wrapper pattern for multi-function routing)
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
# 2. Copy functions + generate handler.ts wrappers
###############################################################################
echo "[2/4] Copying functions and generating handlers..."

FUNC_VOLUME_DIR="$SUPABASE_DIR/volumes/functions"
mkdir -p "$FUNC_VOLUME_DIR"

for func_name in "${FUNCTIONS[@]}"; do
  mkdir -p "$FUNC_VOLUME_DIR/$func_name"

  # Copy all files in the function directory
  for src_file in "$FUNCTIONS_SRC/$func_name"/*; do
    [ -f "$src_file" ] || continue
    cp "$src_file" "$FUNC_VOLUME_DIR/$func_name/"
  done

  # Generate handler.ts — strip Deno.serve / serve wrapper, export handler
  # This converts the function into an importable module (no top-level server)
  SRC_INDEX="$FUNC_VOLUME_DIR/$func_name/index.ts"
  HANDLER_FILE="$FUNC_VOLUME_DIR/$func_name/handler.ts"

  if [ -f "$SRC_INDEX" ]; then
    # Use Python for reliable multi-pattern transformation
    python3 - "$SRC_INDEX" "$HANDLER_FILE" <<'PYHANDLER'
import sys, re

src = sys.argv[1]
dst = sys.argv[2]

with open(src, 'r') as f:
    code = f.read()

# --- Brace-matching algorithm to find the exact Deno.serve() / serve() block ---

# Find the serve call start
serve_patterns = [
    (r'Deno\.serve\(', 'Deno.serve('),
    (r'(?<!\.)serve\(', 'serve('),
]

serve_start = -1
serve_call_end = -1  # position right after the opening paren of serve(
for pat, _ in serve_patterns:
    m = re.search(pat, code)
    if m:
        serve_start = m.start()
        serve_call_end = m.end()  # points right after '('
        break

if serve_start == -1:
    # No serve() found — just copy as-is with a default export wrapper
    with open(dst, 'w') as f:
        f.write(code + '\nexport default async (req: Request) => new Response("not implemented", {status:501});\n')
    sys.exit(0)

# Now find the matching closing ')' for the serve( call using brace/paren tracking
# We start right after 'serve(' so paren_depth starts at 1
pos = serve_call_end
paren_depth = 1
brace_depth = 0
in_string = None  # None, '"', "'", '`'
escape_next = False
code_len = len(code)

while pos < code_len and paren_depth > 0:
    ch = code[pos]
    
    if escape_next:
        escape_next = False
        pos += 1
        continue
    
    if ch == '\\' and in_string:
        escape_next = True
        pos += 1
        continue
    
    if in_string:
        if ch == in_string:
            in_string = None
        pos += 1
        continue
    
    # Check for template literals, single/double quotes
    if ch in ('"', "'", '`'):
        in_string = ch
        pos += 1
        continue
    
    # Check for line comments
    if ch == '/' and pos + 1 < code_len:
        next_ch = code[pos + 1]
        if next_ch == '/':
            # Skip to end of line
            nl = code.find('\n', pos)
            pos = nl + 1 if nl != -1 else code_len
            continue
        elif next_ch == '*':
            # Skip block comment
            end_comment = code.find('*/', pos + 2)
            pos = end_comment + 2 if end_comment != -1 else code_len
            continue
    
    if ch == '(':
        paren_depth += 1
    elif ch == ')':
        paren_depth -= 1
    elif ch == '{':
        brace_depth += 1
    elif ch == '}':
        brace_depth -= 1
    
    pos += 1

# pos now points right after the closing ')' of serve(...)
serve_end = pos

# Also consume the trailing semicolon if present
if serve_end < code_len and code[serve_end] == ';':
    serve_end += 1

# Extract parts
before_serve = code[:serve_start]
serve_block = code[serve_start:serve_end]
after_serve = code[serve_end:]

# Extract the handler from the serve block
# The serve block looks like: Deno.serve(async (req) => { ... })  or  Deno.serve({opts}, async (req) => { ... })
# We need to extract: async (req) => { ... }

# Find 'async' inside the serve block arguments
inner = code[serve_call_end:serve_end]  # content between serve( ... )
async_match = re.search(r'async\s*\(\s*req\s*(?::\s*Request)?\s*\)\s*=>\s*\{', inner)

if async_match:
    handler_start_in_inner = async_match.start()
    # The handler runs from async_match.start() to the end of the inner block minus the closing ')'
    # We need to find the matching '}' for the opening '{'
    handler_code_start = serve_call_end + async_match.end()  # position after the opening '{'
    
    # Find matching closing brace
    hpos = handler_code_start
    hdepth = 1
    h_in_string = None
    h_escape = False
    
    while hpos < code_len and hdepth > 0:
        hch = code[hpos]
        
        if h_escape:
            h_escape = False
            hpos += 1
            continue
        if hch == '\\' and h_in_string:
            h_escape = True
            hpos += 1
            continue
        if h_in_string:
            if hch == h_in_string:
                h_in_string = None
            hpos += 1
            continue
        if hch in ('"', "'", '`'):
            h_in_string = hch
            hpos += 1
            continue
        if hch == '/' and hpos + 1 < code_len:
            nch = code[hpos + 1]
            if nch == '/':
                nl = code.find('\n', hpos)
                hpos = nl + 1 if nl != -1 else code_len
                continue
            elif nch == '*':
                ec = code.find('*/', hpos + 2)
                hpos = ec + 2 if ec != -1 else code_len
                continue
        if hch == '{':
            hdepth += 1
        elif hch == '}':
            hdepth -= 1
        hpos += 1
    
    # hpos points right after the closing '}'
    handler_body = code[handler_code_start:hpos - 1]  # content between { and }
    
    # Build the handler export
    handler_export = f'export default async (req: Request) => {{\n{handler_body}\n}}'
else:
    # Fallback: couldn't parse handler, export stub
    handler_export = 'export default async (req: Request) => new Response("parse error", {status:501})'

# Remove old serve import if present (std lib)
before_serve = re.sub(
    r'import\s*\{\s*serve\s*\}\s*from\s*"https://deno\.land/std[^"]*";\s*\n?',
    '',
    before_serve
)

# Combine: imports/constants + handler export + any trailing helper functions
output = before_serve.rstrip('\n') + '\n\n' + handler_export + '\n'
if after_serve.strip():
    output += '\n' + after_serve.lstrip('\n')

with open(dst, 'w') as f:
    f.write(output)
PYHANDLER

    echo "  Copied + handler: $func_name/"
  else
    echo "  Copied (no index.ts to wrap): $func_name/"
  fi
done

echo "  ✓ Functions copied with handler wrappers"

###############################################################################
# 3. Create main router (imports handler.ts, single Deno.serve)
###############################################################################
echo "[3/4] Creating main router for edge runtime..."

MAIN_DIR="$FUNC_VOLUME_DIR/main"
mkdir -p "$MAIN_DIR"

python3 - "$MAIN_DIR/index.ts" "${FUNCTIONS[@]}" <<'PYSCRIPT'
import sys, datetime

output_file = sys.argv[1]
functions = sys.argv[2:]

# Build static imports
imports = ""
for fn in functions:
    safe_name = fn.replace("-", "_")
    imports += f"import {safe_name}_handler from '../{fn}/handler.ts';\n"

# Build switch cases
cases = ""
for fn in functions:
    safe_name = fn.replace("-", "_")
    cases += f"""
    case '/{fn}':
    case '/functions/v1/{fn}': {{
      return {safe_name}_handler(req);
    }}"""

available = ", ".join(f'"{fn}"' for fn in functions)
date_str = datetime.date.today().isoformat()

content = f'''// Auto-generated main router for self-hosted Supabase Edge Functions
// Generated: {date_str}
// Functions: {", ".join(functions)}

{imports}
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

print(f"  ✓ Main router created with {len(functions)} routes (static imports)")
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
  sleep 5
else
  echo "  ⚠ Functions container not found — start Supabase first"
  echo "    Run: cd $SUPABASE_DIR && docker compose up -d"
  exit 0
fi

# Test endpoints
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
echo "  Edge functions deployed successfully"
echo "============================================"
echo ""
echo "  Functions dir: $FUNC_VOLUME_DIR"
echo "  Available functions:"
for func_name in "${FUNCTIONS[@]}"; do
  echo "    - ${SUPA_URL}/functions/v1/$func_name"
done
echo ""
