

## Fix: Add missing Supabase Docker environment variables

### Problem
The Supabase `docker-compose.yml` expects ~30+ environment variables that your `.env` doesn't define. Most default to blank strings (harmless warnings), but `DOCKER_SOCKET_LOCATION` being empty causes the fatal error:
```
invalid spec: :/var/run/docker.sock:ro,z: empty section between colons
```
This is a Docker volume mount like `${DOCKER_SOCKET_LOCATION}:/var/run/docker.sock:ro,z` — when empty, Docker can't parse it.

### Fix
Update `deploy/setup-supabase.sh` to include ALL required variables in the generated `.env` block. The key additions:

```bash
# Docker
DOCKER_SOCKET_LOCATION=/var/run/docker.sock

# Kong ports
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443

# PostgREST
PGRST_DB_SCHEMAS=public,storage,graphql_public

# JWT
JWT_EXPIRY=3600

# Pooler (Supavisor)
POOLER_PROXY_PORT_TRANSACTION=6543
POOLER_DEFAULT_POOL_SIZE=20
POOLER_MAX_CLIENT_CONN=100
POOLER_TENANT_ID=default-tenant
POOLER_DB_POOL_SIZE=20

# Security keys
SECRET_KEY_BASE=<generated>
VAULT_ENC_KEY=<generated>
PG_META_CRYPTO_KEY=<generated>

# Storage
GLOBAL_S3_BUCKET=stub
S3_PROTOCOL_ACCESS_KEY_ID=stub
S3_PROTOCOL_ACCESS_KEY_SECRET=stub
STORAGE_TENANT_ID=stub
REGION=local
IMGPROXY_AUTO_WEBP=true

# Logflare (analytics - can be stubs)
LOGFLARE_PUBLIC_ACCESS_TOKEN=stub
LOGFLARE_PRIVATE_ACCESS_TOKEN=stub

# SMTP (blank defaults are fine)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_SENDER_NAME=MRB
SMTP_ADMIN_EMAIL=admin@hbl.com

# Auth toggles
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
ENABLE_ANONYMOUS_USERS=false
DISABLE_SIGNUP=false
ADDITIONAL_REDIRECT_URLS=

# Mailer URL paths
MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify
MAILER_URLPATHS_INVITE=/auth/v1/verify
MAILER_URLPATHS_RECOVERY=/auth/v1/verify
MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify
```

### Immediate workaround
Since the `.env` already exists and the script skips it, we also need to change the condition so it **force-rewrites** the `.env` when critical variables are missing (check for `DOCKER_SOCKET_LOCATION`).

### Changes

**File: `deploy/setup-supabase.sh`**
1. Update the skip condition (line 151) to also rewrite if `DOCKER_SOCKET_LOCATION` is missing from `.env`
2. Add all ~30 missing environment variables to the `cat > .env` block (lines 158-213)
3. Generate random values for `SECRET_KEY_BASE`, `VAULT_ENC_KEY`, `PG_META_CRYPTO_KEY` using `openssl rand`

### After the fix
Run on server:
```bash
sudo bash deploy/setup-supabase.sh
# or force rewrite:
FORCE_RECONFIGURE=true sudo bash deploy/setup-supabase.sh
```

### No database or migration changes needed.

