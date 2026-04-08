#!/usr/bin/env bash
###############################################################################
# HBL MRB – Full Production Installation (Self-Hosted Supabase)
# This is the MASTER installer — runs all setup scripts in order.
# Run as root: sudo bash deploy/install.sh
# Updated: 2026-04-07 (reviewed & fixed)
###############################################################################
set -euo pipefail

APP_USER="iml"
APP_DIR="/opt/MRB"
FRONTEND_DIR="$APP_DIR/frontend"
BACKEND_DIR="$APP_DIR/sap-proxy/mrb-backend"
LOG_DIR="/var/log/mrb"
ENV_FILE="$APP_DIR/.env"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "╔══════════════════════════════════════════════╗"
echo "║  HBL MRB – Full Production Installation      ║"
echo "║  Self-Hosted Supabase + Frontend + Middleware ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

###############################################################################
# PHASE 1: System Preparation
###############################################################################
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 1: System Preparation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

apt-get update -y
apt-get install -y curl wget git build-essential nginx ufw unzip jq \
  ca-certificates gnupg lsb-release postgresql-client openssl rsync python3

# Install Node.js 20 LTS
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "  Node: $(node -v) | npm: $(npm -v)"

# Install PM2 globally
npm install -g pm2

echo "  ✓ System packages installed"

###############################################################################
# PHASE 2: Create user and directory structure
###############################################################################
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 2: Directory Structure"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

id "$APP_USER" &>/dev/null || useradd -r -m -s /bin/bash "$APP_USER"

mkdir -p "$FRONTEND_DIR" "$BACKEND_DIR" "$LOG_DIR"
mkdir -p "$APP_DIR/backups"
mkdir -p "$APP_DIR/scripts"

echo "  ✓ Directories created"

###############################################################################
# PHASE 3: Copy application files
###############################################################################
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 3: Copy Application Files"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Copy frontend source (excluding deploy dir to avoid circular copy)
rsync -a --exclude='node_modules' --exclude='.git' \
  "$PROJECT_ROOT/" "$FRONTEND_DIR/"

# Copy all deploy scripts to scripts dir (from source, not from frontend copy)
cp "$SCRIPT_DIR"/*.sh "$APP_DIR/scripts/"
cp "$SCRIPT_DIR"/*.sql "$APP_DIR/scripts/" 2>/dev/null || true
chmod +x "$APP_DIR/scripts/"*.sh

# Copy middleware if present
if [ -d "$PROJECT_ROOT/middleware" ]; then
  rsync -a --exclude='node_modules' "$PROJECT_ROOT/middleware/" "$BACKEND_DIR/"
  echo "  ✓ Middleware files copied"
fi

echo "  ✓ Application files copied"
echo "  ✓ Deploy scripts → $APP_DIR/scripts/"

###############################################################################
# PHASE 4: Install & Start Self-Hosted Supabase
###############################################################################
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 4: Self-Hosted Supabase"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Run setup-supabase from the scripts dir (already copied in phase 3)
bash "$APP_DIR/scripts/setup-supabase.sh"

# Reload env after Supabase setup (it generates the .env)
if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
else
  echo "  ✗ .env file not created by setup-supabase.sh!"
  exit 1
fi

###############################################################################
# PHASE 5: Apply Database Migrations
###############################################################################
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 5: Database Migrations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

bash "$APP_DIR/scripts/setup-db.sh"

###############################################################################
# PHASE 5b: Seed Configuration Data
###############################################################################
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 5b: Seed Configuration Data"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

bash "$APP_DIR/scripts/seed-data.sh" || echo "  ⚠ Seed data had issues (non-fatal)"

###############################################################################
# PHASE 5c: Create Demo Users
###############################################################################
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 5c: Create Demo Users"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

bash "$APP_DIR/scripts/create-users.sh" || echo "  ⚠ User creation had issues (non-fatal)"

###############################################################################
# PHASE 6: Build Frontend
###############################################################################
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 6: Build Frontend"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$FRONTEND_DIR"
cp "$ENV_FILE" .env
npm ci --production=false
npm run build

echo "  ✓ Frontend built → $FRONTEND_DIR/dist"

###############################################################################
# PHASE 7: Install Middleware Dependencies
###############################################################################
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 7: Middleware Dependencies"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "$BACKEND_DIR/package.json" ]; then
  cd "$BACKEND_DIR"
  npm ci --production
  echo "  ✓ Middleware dependencies installed"
else
  echo "  ⚠ No middleware package.json — skipping"
fi

###############################################################################
# PHASE 8: Configure Nginx
###############################################################################
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 8: Nginx Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cat > /etc/nginx/sites-available/mrb <<'NGINX'
server {
    listen 3000;
    server_name _;
    root /opt/MRB/frontend/dist;
    index index.html;

    # SPA fallback — React Router deep links
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy SAP middleware
    location /sap/api/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
    gzip_min_length 256;
    gzip_vary on;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
NGINX

ln -sf /etc/nginx/sites-available/mrb /etc/nginx/sites-enabled/mrb
rm -f /etc/nginx/sites-enabled/default

if nginx -t 2>/dev/null; then
  systemctl restart nginx
  echo "  ✓ Nginx configured on port 3000"
else
  echo "  ✗ Nginx config test failed!"
  nginx -t
  exit 1
fi

###############################################################################
# PHASE 9: Deploy Edge Functions
###############################################################################
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 9: Edge Functions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

bash "$APP_DIR/scripts/deploy-edge-functions.sh" || echo "  ⚠ Edge function deployment had issues (non-fatal)"

###############################################################################
# PHASE 10: Set Permissions & Start Services
###############################################################################
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 10: Start Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Set ownership BEFORE starting services as iml
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$LOG_DIR"
chmod 600 "$ENV_FILE"

sudo -u "$APP_USER" bash "$APP_DIR/scripts/start.sh" || echo "  ⚠ Service start had issues (check PM2 logs)"

###############################################################################
# PHASE 11: Setup Auto-Start & Scheduler
###############################################################################
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 11: Scheduler & Boot Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

bash "$APP_DIR/scripts/setup-scheduler.sh" || echo "  ⚠ Scheduler setup had issues (non-fatal)"

###############################################################################
# PHASE 12: Firewall
###############################################################################
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 12: Firewall"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ufw allow 22/tcp   >/dev/null 2>&1 || true   # SSH
ufw allow 3000/tcp >/dev/null 2>&1 || true   # Frontend
ufw allow 3001/tcp >/dev/null 2>&1 || true   # Supabase Studio (optional)
ufw --force enable  >/dev/null 2>&1 || true
echo "  ✓ Firewall configured (SSH, Frontend, Studio)"

###############################################################################
# PHASE 13: Health Check
###############################################################################
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PHASE 13: Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

bash "$APP_DIR/scripts/health-check.sh" || true

###############################################################################
# Summary
###############################################################################
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  Installation Complete!                       ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "  Application:       http://$SERVER_IP:3000"
echo "  Supabase Studio:   http://$SERVER_IP:3001"
echo "  Supabase API:      http://$SERVER_IP:8000"
echo "  SAP Middleware:     http://$SERVER_IP:3002"
echo ""
echo "  Credentials:       $ENV_FILE"
echo "  Supabase config:   /opt/supabase/docker/.env"
echo ""
echo "  ─── Next Steps ─────────────────────────────"
echo "  1. Create admin user:"
echo "     Access http://$SERVER_IP:3000 and sign up, then:"
echo ""
echo "     source $ENV_FILE"
echo "     psql \"\$SUPABASE_DB_URL\" -c \\"
echo "       \"SELECT user_id, email FROM profiles;\""
echo "     psql \"\$SUPABASE_DB_URL\" -c \\"
echo "       \"INSERT INTO user_roles (user_id, role) VALUES ('<uuid>', 'admin');\""
echo "     psql \"\$SUPABASE_DB_URL\" -c \\"
echo "       \"INSERT INTO user_plants (user_id, plant_code) VALUES ('<uuid>', '1300');\""
echo ""
echo "  2. Configure roles (after logging in as admin):"
echo "     → Role Management page"
echo "     → Workflow Config page"
echo ""
echo "  ─── Management Commands ────────────────────"
echo "  Start:     sudo -u iml bash $APP_DIR/scripts/start.sh"
echo "  Stop:      sudo -u iml bash $APP_DIR/scripts/stop.sh"
echo "  Restart:   sudo -u iml bash $APP_DIR/scripts/restart.sh"
echo "  Update:    sudo -u iml bash $APP_DIR/scripts/update.sh"
echo "  Health:    sudo bash $APP_DIR/scripts/health-check.sh"
echo "  DB Setup:  sudo bash $APP_DIR/scripts/setup-db.sh"
echo "  Edge Fn:   sudo bash $APP_DIR/scripts/deploy-edge-functions.sh"
echo "  Logs:      pm2 logs mrb-app"
echo ""
