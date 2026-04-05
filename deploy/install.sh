#!/usr/bin/env bash
###############################################################################
# HBL MRB – Fresh Linux Production Installation
# Run as root or with sudo: sudo bash deploy/install.sh
###############################################################################
set -euo pipefail

APP_USER="iml"
APP_DIR="/opt/MRB"
FRONTEND_DIR="$APP_DIR/frontend"
BACKEND_DIR="$APP_DIR/sap-proxy/mrb-backend"
LOG_DIR="/var/log/mrb"
ENV_FILE="$APP_DIR/.env"

echo "============================================"
echo "  HBL MRB – Fresh Production Installation"
echo "============================================"

###############################################################################
# 1. System Preparation
###############################################################################
echo "[1/8] System preparation..."

apt-get update -y
apt-get install -y curl wget git build-essential nginx ufw unzip jq \
  ca-certificates gnupg lsb-release

# Install Node.js 20 LTS
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "  Node: $(node -v) | npm: $(npm -v)"

# Install PM2 globally
npm install -g pm2

# Install Deno (for standalone scheduler)
if ! command -v deno &>/dev/null; then
  curl -fsSL https://deno.land/install.sh | sh
  ln -sf /root/.deno/bin/deno /usr/local/bin/deno 2>/dev/null || true
fi

###############################################################################
# 2. Create user and directory structure
###############################################################################
echo "[2/8] Creating directories and user..."

id "$APP_USER" &>/dev/null || useradd -r -m -s /bin/bash "$APP_USER"

mkdir -p "$FRONTEND_DIR" "$BACKEND_DIR" "$LOG_DIR"
mkdir -p "$APP_DIR/backups"
mkdir -p "$APP_DIR/scripts"

###############################################################################
# 3. Copy application files
###############################################################################
echo "[3/8] Copying application files..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Copy frontend source
rsync -a --exclude='node_modules' --exclude='.git' --exclude='deploy' \
  "$PROJECT_ROOT/" "$FRONTEND_DIR/"

# Copy middleware if present
if [ -d "$PROJECT_ROOT/middleware" ]; then
  rsync -a --exclude='node_modules' "$PROJECT_ROOT/middleware/" "$BACKEND_DIR/"
fi

###############################################################################
# 4. Environment configuration
###############################################################################
echo "[4/8] Setting up environment..."

if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<'ENVEOF'
# ── Supabase / PostgreSQL ─────────────────────────────────────────
VITE_SUPABASE_URL=http://10.10.4.178:8000
VITE_SUPABASE_PUBLISHABLE_KEY=<YOUR_ANON_KEY>
VITE_SUPABASE_PROJECT_ID=<YOUR_PROJECT_ID>
SUPABASE_SERVICE_ROLE_KEY=<YOUR_SERVICE_ROLE_KEY>
SUPABASE_DB_URL=postgresql://postgres:<DB_PASSWORD>@10.10.4.178:5432/postgres

# ── SAP Middleware ────────────────────────────────────────────────
SAP_PROXY_PORT=3002
SAP_PROXY_SECRET=7d9f2e1b4a5c8e3d6f1g0h2j4k6l8m0n

# ── Scheduler ─────────────────────────────────────────────────────
SCHEDULER_PORT=3100
SCHEDULER_POLL_INTERVAL=60000

# ── Frontend Serving ──────────────────────────────────────────────
FRONTEND_PORT=3000
ENVEOF
  echo "  ⚠ Created $ENV_FILE — EDIT IT with your actual values before proceeding!"
  echo "  Run: nano $ENV_FILE"
else
  echo "  ✓ $ENV_FILE already exists — skipping"
fi

###############################################################################
# 5. Build frontend
###############################################################################
echo "[5/8] Building frontend..."

cd "$FRONTEND_DIR"
cp "$ENV_FILE" .env 2>/dev/null || true
npm ci --production=false
npm run build

echo "  ✓ Frontend built → $FRONTEND_DIR/dist"

###############################################################################
# 6. Install middleware dependencies
###############################################################################
echo "[6/8] Installing middleware dependencies..."

if [ -f "$BACKEND_DIR/package.json" ]; then
  cd "$BACKEND_DIR"
  npm ci --production
  echo "  ✓ Middleware dependencies installed"
else
  echo "  ⚠ No middleware package.json found at $BACKEND_DIR — skipping"
fi

###############################################################################
# 7. Configure Nginx
###############################################################################
echo "[7/8] Configuring Nginx..."

cat > /etc/nginx/sites-available/mrb <<'NGINX'
server {
    listen 3000;
    server_name _;
    root /opt/MRB/frontend/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy SAP middleware
    location /sap/api/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 60s;
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 256;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

ln -sf /etc/nginx/sites-available/mrb /etc/nginx/sites-enabled/mrb
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
echo "  ✓ Nginx configured on port 3000"

###############################################################################
# 8. Set permissions
###############################################################################
echo "[8/8] Setting permissions..."

chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$LOG_DIR"
chmod 600 "$ENV_FILE"

echo ""
echo "============================================"
echo "  Installation Complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Edit $ENV_FILE with your actual credentials"
echo "  2. Run: sudo bash $APP_DIR/scripts/setup-db.sh"
echo "  3. Run: sudo -u $APP_USER bash $APP_DIR/scripts/start.sh"
echo "  4. Run: sudo bash $APP_DIR/scripts/setup-scheduler.sh"
echo ""
