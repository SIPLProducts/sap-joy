#!/usr/bin/env bash
###############################################################################
# HBL MRB – Install & Configure Self-Hosted Supabase (Docker)
# Run as root or with sudo: sudo bash deploy/setup-supabase.sh
# Updated: 2026-04-07
###############################################################################
set -euo pipefail

SUPABASE_DIR="/opt/supabase"
APP_DIR="/opt/MRB"
ENV_FILE="$APP_DIR/.env"

# Detect server IP (LAN)
SERVER_IP=$(hostname -I | awk '{print $1}')

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

# Add iml user to docker group
usermod -aG docker iml 2>/dev/null || true

# Ensure docker compose plugin is available
if ! docker compose version &>/dev/null; then
  apt-get install -y docker-compose-plugin 2>/dev/null || {
    COMPOSE_VERSION="v2.27.0"
    mkdir -p /usr/local/lib/docker/cli-plugins
    curl -fsSL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" \
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

if [ -d "$SUPABASE_DIR/docker" ]; then
  echo "  ✓ Supabase directory already exists at $SUPABASE_DIR/docker"
else
  cd "$SUPABASE_DIR"
  git clone --depth 1 https://github.com/supabase/supabase.git repo
  cp -r repo/docker "$SUPABASE_DIR/docker"
  rm -rf repo
  echo "  ✓ Supabase Docker cloned"
fi

###############################################################################
# 3. Generate secrets
###############################################################################
echo "[3/7] Generating Supabase secrets..."

cd "$SUPABASE_DIR/docker"

# Generate secure random values
POSTGRES_PASSWORD=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 32)
DASHBOARD_PASSWORD=$(openssl rand -base64 16 | tr -d '=+/')

# Generate JWT tokens using the secret
generate_jwt() {
  local role=$1
  local secret=$2
  # Header
  local header=$(echo -n '{"alg":"HS256","typ":"JWT"}' | openssl base64 -e | tr -d '=' | tr '/+' '_-' | tr -d '\n')
  # Payload - expires in ~10 years
  local exp=$(($(date +%s) + 315360000))
  local iat=$(date +%s)
  local payload=$(echo -n "{\"iss\":\"supabase\",\"ref\":\"local\",\"role\":\"$role\",\"iat\":$iat,\"exp\":$exp}" | openssl base64 -e | tr -d '=' | tr '/+' '_-' | tr -d '\n')
  # Signature
  local signature=$(echo -n "$header.$payload" | openssl dgst -sha256 -hmac "$secret" -binary | openssl base64 -e | tr -d '=' | tr '/+' '_-' | tr -d '\n')
  echo "$header.$payload.$signature"
}

ANON_KEY=$(generate_jwt "anon" "$JWT_SECRET")
SERVICE_ROLE_KEY=$(generate_jwt "service_role" "$JWT_SECRET")

echo "  ✓ Secrets generated"

###############################################################################
# 4. Configure Supabase .env
###############################################################################
echo "[4/7] Configuring Supabase environment..."

# Copy template .env if not exists
if [ -f ".env.example" ]; then
  cp .env.example .env
elif [ -f ".env" ]; then
  echo "  ✓ .env already exists"
else
  echo "  ⚠ No .env.example found — creating from scratch"
fi

# Write/overwrite the .env with our values
cat > .env <<SUPAENV
############
# Secrets
############
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
DASHBOARD_USERNAME=supabase
DASHBOARD_PASSWORD=$DASHBOARD_PASSWORD

############
# Database
############
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432

############
# API
############
SITE_URL=http://$SERVER_IP:3000
API_EXTERNAL_URL=http://$SERVER_IP:8000
SUPABASE_PUBLIC_URL=http://$SERVER_IP:8000

############
# Auth
############
GOTRUE_SITE_URL=http://$SERVER_IP:3000
GOTRUE_EXTERNAL_EMAIL_ENABLED=true
GOTRUE_MAILER_AUTOCONFIRM=false
GOTRUE_SMS_AUTOCONFIRM=false
GOTRUE_DISABLE_SIGNUP=false
GOTRUE_URI_ALLOW_LIST=http://$SERVER_IP:3000
GOTRUE_JWT_EXP=3600
GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated

############
# Studio
############
STUDIO_DEFAULT_ORGANIZATION=HBL MRB
STUDIO_DEFAULT_PROJECT=MRB Application
STUDIO_PORT=3001

############
# Edge Functions
############
FUNCTIONS_VERIFY_JWT=false

############
# Misc
############
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false
SUPAENV

echo "  ✓ Supabase .env configured"

###############################################################################
# 5. Patch docker-compose for Edge Functions host access
###############################################################################
echo "[5/7] Patching docker-compose for host networking..."

COMPOSE_FILE="docker-compose.yml"
if [ -f "$COMPOSE_FILE" ]; then
  # Add extra_hosts to functions service if not already present
  if ! grep -q "host.docker.internal:host-gateway" "$COMPOSE_FILE" 2>/dev/null; then
    # Use sed to add extra_hosts after the functions service definition
    sed -i '/^  functions:/,/^  [a-z]/ {
      /container_name:/a\    extra_hosts:\n      - "host.docker.internal:host-gateway"
    }' "$COMPOSE_FILE" 2>/dev/null || echo "  ⚠ Could not auto-patch — add extra_hosts manually"
  fi
  echo "  ✓ docker-compose patched for host.docker.internal"
else
  echo "  ⚠ docker-compose.yml not found"
fi

###############################################################################
# 6. Start Supabase
###############################################################################
echo "[6/7] Starting Supabase containers..."

docker compose pull
docker compose up -d

echo "  Waiting for services to be healthy..."
sleep 15

# Wait for PostgREST to be ready
for i in $(seq 1 30); do
  if curl -sf "http://localhost:8000/rest/v1/" -H "apikey: $ANON_KEY" >/dev/null 2>&1; then
    echo "  ✓ Supabase API is responding"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "  ⚠ Supabase API not responding yet — check: docker compose logs"
  fi
  sleep 2
done

###############################################################################
# 7. Save credentials to app .env
###############################################################################
echo "[7/7] Saving credentials to application .env..."

mkdir -p "$APP_DIR"

cat > "$ENV_FILE" <<APPENV
# ── Supabase / PostgreSQL (Self-Hosted) ───────────────────────────
# Auto-generated by setup-supabase.sh on $(date +%Y-%m-%d)
VITE_SUPABASE_URL=http://$SERVER_IP:8000
VITE_SUPABASE_PUBLISHABLE_KEY=$ANON_KEY
VITE_SUPABASE_PROJECT_ID=local
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
SUPABASE_DB_URL=postgresql://postgres:$POSTGRES_PASSWORD@$SERVER_IP:5432/postgres

# ── SAP Middleware ────────────────────────────────────────────────
SAP_PROXY_PORT=3002
SAP_PROXY_SECRET=$(openssl rand -hex 16)

# ── Scheduler ─────────────────────────────────────────────────────
SCHEDULER_PORT=3100
SCHEDULER_POLL_INTERVAL=60000

# ── Frontend Serving ──────────────────────────────────────────────
FRONTEND_PORT=3000
APPENV

chmod 600 "$ENV_FILE"
chown iml:iml "$ENV_FILE" 2>/dev/null || true

echo ""
echo "============================================"
echo "  Supabase Setup Complete!"
echo "============================================"
echo ""
echo "  Supabase API:      http://$SERVER_IP:8000"
echo "  Supabase Studio:   http://$SERVER_IP:3001"
echo "  Studio Login:      supabase / $DASHBOARD_PASSWORD"
echo "  PostgreSQL:        postgresql://postgres:****@$SERVER_IP:5432/postgres"
echo ""
echo "  Credentials saved to: $ENV_FILE"
echo "  Supabase config at:   $SUPABASE_DIR/docker/.env"
echo ""
echo "  Docker containers:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || docker compose ps
echo ""
echo "  Next: Run install.sh to build the frontend and apply migrations"
echo ""
