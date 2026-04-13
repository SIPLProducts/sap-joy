#!/usr/bin/env bash
###############################################################################
# HBL MRB – Install & Configure Self-Hosted Supabase (Docker)
# Run as root or with sudo: sudo bash deploy/setup-supabase.sh
# Updated: 2026-04-13 (ports: API=8100, PG=5433, Frontend=3200, Middleware=3202)
###############################################################################
set -euo pipefail

SUPABASE_DIR="/opt/supabase"
APP_DIR="/opt/MRB"
ENV_FILE="$APP_DIR/.env"

# Detect server IP (LAN) — fallback to localhost
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$SERVER_IP" ]; then
  SERVER_IP="127.0.0.1"
fi

echo "============================================"
echo "  HBL MRB – Self-Hosted Supabase Setup"
echo "  Server IP: $SERVER_IP"
echo "============================================"

###############################################################################
# 1. Install Docker & Docker Compose
###############################################################################
echo "[1/7] Installing Docker..."

if command -v docker &>/dev/null; then
  echo "  ✓ Docker already installed: $(docker --version)"
else
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo "  ✓ Docker installed: $(docker --version)"
fi

# Add iml user to docker group (ignore if user doesn't exist yet)
usermod -aG docker iml 2>/dev/null || true

# Ensure docker compose plugin is available
if ! docker compose version &>/dev/null; then
  apt-get install -y docker-compose-plugin 2>/dev/null || {
    COMPOSE_VERSION="v2.27.0"
    ARCH=$(uname -m)
    mkdir -p /usr/local/lib/docker/cli-plugins
    curl -fsSL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-${ARCH}" \
      -o /usr/local/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  }
  echo "  ✓ Docker Compose installed"
else
  echo "  ✓ Docker Compose already available"
fi

###############################################################################
# 2. Clone Supabase Docker
###############################################################################
echo "[2/7] Setting up Supabase..."

mkdir -p "$SUPABASE_DIR"

if [ -d "$SUPABASE_DIR/docker" ] && [ -f "$SUPABASE_DIR/docker/docker-compose.yml" ]; then
  echo "  ✓ Supabase directory already exists at $SUPABASE_DIR/docker"
else
  cd "$SUPABASE_DIR"
  rm -rf repo
  git clone --depth 1 https://github.com/supabase/supabase.git repo
  cp -r repo/docker "$SUPABASE_DIR/docker"
  rm -rf repo
  echo "  ✓ Supabase Docker cloned"
fi

###############################################################################
# 3. Generate secrets (skip if already configured)
###############################################################################
echo "[3/7] Generating Supabase secrets..."

cd "$SUPABASE_DIR/docker"

# Skip secret generation if already configured
if [ -f ".env" ] && grep -q "^JWT_SECRET=" .env 2>/dev/null; then
  echo "  ✓ Supabase .env already exists — loading existing secrets"
  # Source safely — use env to avoid unquoted-value issues
  while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
    export "$key=$value" 2>/dev/null || true
  done < .env

  # Re-read existing values
  POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
  JWT_SECRET="${JWT_SECRET:-}"
  ANON_KEY="${ANON_KEY:-}"
  SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-}"
  DASHBOARD_PASSWORD="${DASHBOARD_PASSWORD:-admin}"
else
  # Generate secure random values
  POSTGRES_PASSWORD=$(openssl rand -hex 16)
  JWT_SECRET=$(openssl rand -hex 32)
  DASHBOARD_PASSWORD=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)

  # Generate JWT tokens using Python (more reliable than openssl base64)
  generate_jwt() {
    local role=$1
    local secret=$2
    python3 -c "
import hmac, hashlib, base64, json, time

def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

header = b64url(json.dumps({'alg':'HS256','typ':'JWT'}).encode())
payload = b64url(json.dumps({
    'iss':'supabase','ref':'local','role':'$role',
    'iat':int(time.time()),'exp':int(time.time())+315360000
}).encode())
sig = b64url(hmac.new('$secret'.encode(), f'{header}.{payload}'.encode(), hashlib.sha256).digest())
print(f'{header}.{payload}.{sig}')
" 2>/dev/null || {
      # Fallback: use Node.js if Python not available
      node -e "
const crypto = require('crypto');
const b64url = (s) => Buffer.from(s).toString('base64url');
const header = b64url(JSON.stringify({alg:'HS256',typ:'JWT'}));
const payload = b64url(JSON.stringify({iss:'supabase',ref:'local',role:'$role',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+315360000}));
const sig = crypto.createHmac('sha256','$secret').update(header+'.'+payload).digest('base64url');
console.log(header+'.'+payload+'.'+sig);
" 2>/dev/null
    }
  }

  ANON_KEY=$(generate_jwt "anon" "$JWT_SECRET")
  SERVICE_ROLE_KEY=$(generate_jwt "service_role" "$JWT_SECRET")

  if [ -z "$ANON_KEY" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "  ✗ Failed to generate JWT tokens!"
    echo "    Ensure python3 or node is installed"
    exit 1
  fi
fi

echo "  ✓ Secrets ready"

###############################################################################
# 4. Configure Supabase .env
###############################################################################
echo "[4/7] Configuring Supabase environment..."

# Only write if not already configured (or force with env var)
# Also rewrite if critical variables like DOCKER_SOCKET_LOCATION are missing
if [ ! -f ".env" ] || [ "${FORCE_RECONFIGURE:-}" = "true" ] || ! grep -q "^JWT_SECRET=" .env 2>/dev/null || ! grep -q "^DOCKER_SOCKET_LOCATION=" .env 2>/dev/null; then
  # Copy template .env if available (for reference vars we might miss)
  if [ -f ".env.example" ] && [ ! -f ".env" ]; then
    cp .env.example .env
  fi

  # Generate additional security keys
  SECRET_KEY_BASE=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)
  VAULT_ENC_KEY=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
  PG_META_CRYPTO_KEY=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
  LOGFLARE_API_KEY=$(openssl rand -hex 16)

  # Write our values
  cat > .env <<SUPAENV
############
# Secrets
# Auto-generated on $(date +%Y-%m-%d) — DO NOT COMMIT
############
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
DASHBOARD_USERNAME=supabase
DASHBOARD_PASSWORD=${DASHBOARD_PASSWORD}

############
# Database
############
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432

############
# API
############
SITE_URL=http://${SERVER_IP}:3200
API_EXTERNAL_URL=http://${SERVER_IP}:8100
SUPABASE_PUBLIC_URL=http://${SERVER_IP}:8100

############
# Auth (GoTrue)
############
GOTRUE_SITE_URL=http://${SERVER_IP}:3200
GOTRUE_EXTERNAL_EMAIL_ENABLED=true
GOTRUE_MAILER_AUTOCONFIRM=false
GOTRUE_SMS_AUTOCONFIRM=false
GOTRUE_DISABLE_SIGNUP=false
GOTRUE_URI_ALLOW_LIST=http://${SERVER_IP}:3200
GOTRUE_JWT_EXP=3600
GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated

############
# JWT
############
JWT_EXPIRY=3600

############
# Studio
############
STUDIO_DEFAULT_ORGANIZATION="HBL MRB"
STUDIO_DEFAULT_PROJECT="MRB Application"
STUDIO_PORT=3001

############
# Edge Functions
############
FUNCTIONS_VERIFY_JWT=false

############
# Kong
############
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443

############
# PostgREST
############
PGRST_DB_SCHEMAS=public,storage,graphql_public

############
# Pooler (Supavisor)
############
POOLER_PROXY_PORT_TRANSACTION=6543
POOLER_DEFAULT_POOL_SIZE=20
POOLER_MAX_CLIENT_CONN=100
POOLER_TENANT_ID=default-tenant
POOLER_DB_POOL_SIZE=20

############
# Security Keys
############
SECRET_KEY_BASE=${SECRET_KEY_BASE}
VAULT_ENC_KEY=${VAULT_ENC_KEY}
PG_META_CRYPTO_KEY=${PG_META_CRYPTO_KEY}

############
# Docker
############
DOCKER_SOCKET_LOCATION=/var/run/docker.sock

############
# Storage
############
GLOBAL_S3_BUCKET=stub
S3_PROTOCOL_ACCESS_KEY_ID=stub
S3_PROTOCOL_ACCESS_KEY_SECRET=stub
STORAGE_TENANT_ID=stub
REGION=local
IMGPROXY_AUTO_WEBP=true

############
# Logflare (Analytics)
############
LOGFLARE_PUBLIC_ACCESS_TOKEN=${LOGFLARE_API_KEY}
LOGFLARE_PRIVATE_ACCESS_TOKEN=${LOGFLARE_API_KEY}

############
# SMTP
############
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_SENDER_NAME=MRB
SMTP_ADMIN_EMAIL=admin@hbl.com

############
# Auth Toggles
############
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
ENABLE_ANONYMOUS_USERS=false
DISABLE_SIGNUP=false
ADDITIONAL_REDIRECT_URLS=
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false

############
# Mailer URL Paths
############
MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify
MAILER_URLPATHS_INVITE=/auth/v1/verify
MAILER_URLPATHS_RECOVERY=/auth/v1/verify
MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify
SUPAENV

  echo "  ✓ Supabase .env written"
else
  echo "  ✓ Supabase .env already configured — skipping"
fi

###############################################################################
# 4.5 Create docker-compose.override.yml for custom port mapping
###############################################################################
echo "  Creating docker-compose.override.yml for port remapping..."

cat > docker-compose.override.yml <<'OVERRIDE'
# Port overrides for HBL MRB deployment
# Kong: 8100 (host) -> 8000 (container)
# PostgreSQL: 5433 (host) -> 5432 (container)
services:
  kong:
    ports:
      - "8100:8000"
      - "8443:8443"
  db:
    ports:
      - "5433:5432"
OVERRIDE

echo "  ✓ docker-compose.override.yml created (Kong→8100, PG→5433)"

###############################################################################
# 5. Patch docker-compose for Edge Functions host access
###############################################################################
echo "[5/7] Patching docker-compose for host networking..."

COMPOSE_FILE="docker-compose.yml"
if [ -f "$COMPOSE_FILE" ]; then
  if ! grep -q "host.docker.internal:host-gateway" "$COMPOSE_FILE" 2>/dev/null; then
    # Use Python/yq for safe YAML patching; fallback to manual instruction
    if command -v python3 &>/dev/null; then
      python3 -c "
import re
with open('$COMPOSE_FILE', 'r') as f:
    content = f.read()
# Find 'functions:' service block and add extra_hosts after container_name line
if 'host.docker.internal' not in content:
    # Insert after the first 'container_name:' line within functions service
    pattern = r'(  functions:.*?container_name:[^\n]*)'
    replacement = r'\1\n    extra_hosts:\n      - \"host.docker.internal:host-gateway\"'
    content = re.sub(pattern, replacement, content, count=1, flags=re.DOTALL)
    with open('$COMPOSE_FILE', 'w') as f:
        f.write(content)
    print('  ✓ docker-compose patched via Python')
" 2>/dev/null || {
        echo "  ⚠ Could not auto-patch docker-compose.yml"
        echo "    Manually add under 'functions:' service:"
        echo "      extra_hosts:"
        echo "        - \"host.docker.internal:host-gateway\""
      }
    else
      echo "  ⚠ python3 not available for YAML patching"
      echo "    Manually add under 'functions:' service:"
      echo "      extra_hosts:"
      echo "        - \"host.docker.internal:host-gateway\""
    fi
  else
    echo "  ✓ docker-compose already has host.docker.internal"
  fi
else
  echo "  ⚠ docker-compose.yml not found at $SUPABASE_DIR/docker"
fi

###############################################################################
# 6. Start Supabase
###############################################################################
echo "[6/7] Starting Supabase containers..."

docker compose pull --quiet 2>/dev/null || docker compose pull
docker compose up -d

echo "  Waiting for services to be healthy..."

# Wait for PostgreSQL first (critical for migrations)
echo -n "  PostgreSQL (5433): "
for i in $(seq 1 60); do
  if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
    echo "✓ ready"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "✗ timeout (60s)"
    echo "    Check: docker compose logs db"
  fi
  sleep 2
done

# Wait for Kong/API gateway on port 8100
echo -n "  API Gateway (8100): "
for i in $(seq 1 30); do
  if curl -sf "http://localhost:8100/rest/v1/" -H "apikey: ${ANON_KEY}" >/dev/null 2>&1; then
    echo "✓ ready"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "⚠ not responding yet — may need more time"
    echo "    Check: docker compose logs kong"
  fi
  sleep 2
done

###############################################################################
# 7. Save credentials to app .env
###############################################################################
echo "[7/7] Saving credentials to application .env..."

mkdir -p "$APP_DIR"

# Generate a fresh SAP proxy secret
SAP_SECRET=$(openssl rand -hex 16)

cat > "$ENV_FILE" <<APPENV
# ── Supabase / PostgreSQL (Self-Hosted) ───────────────────────────
# Auto-generated by setup-supabase.sh on $(date +%Y-%m-%d)
VITE_SUPABASE_URL=http://${SERVER_IP}:8100
VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
VITE_SUPABASE_PROJECT_ID=local
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
SUPABASE_DB_URL=postgresql://postgres:${POSTGRES_PASSWORD}@${SERVER_IP}:5433/postgres

# ── SAP Middleware ────────────────────────────────────────────────
SAP_PROXY_PORT=3202
SAP_PROXY_SECRET=${SAP_SECRET}

# ── Scheduler ─────────────────────────────────────────────────────
SCHEDULER_PORT=3100
SCHEDULER_POLL_INTERVAL=60000

# ── Frontend Serving ──────────────────────────────────────────────
FRONTEND_PORT=3200
APPENV

chmod 600 "$ENV_FILE"
chown iml:iml "$ENV_FILE" 2>/dev/null || true

echo ""
echo "============================================"
echo "  Supabase Setup Complete!"
echo "============================================"
echo ""
echo "  Supabase API:      http://$SERVER_IP:8100"
echo "  Supabase Studio:   http://$SERVER_IP:3001"
echo "  Studio Login:      supabase / $DASHBOARD_PASSWORD"
echo "  PostgreSQL:        postgresql://postgres:****@$SERVER_IP:5433/postgres"
echo ""
echo "  Credentials saved to: $ENV_FILE"
echo "  Supabase config at:   $SUPABASE_DIR/docker/.env"
echo ""
echo "  Docker containers:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || docker compose ps
echo ""
