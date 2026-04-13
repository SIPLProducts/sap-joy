

## Fix: `setup-supabase.sh` for new server deployment

### Problem
Line 194: `STUDIO_DEFAULT_ORGANIZATION=HBL MRB` — the unquoted space causes `source .env` to interpret `MRB` as a command, producing `.env: line 41: MRB: command not found`.

### Your target config
- App: `/opt/MRB`
- Supabase API (Kong): port `8100`
- PostgreSQL: port `5433`
- SAP Middleware: port `3202`
- Frontend (Nginx): port `3200`

### Changes

**File: `deploy/setup-supabase.sh`**

1. **Fix the quoting bug** (line 194): Change `STUDIO_DEFAULT_ORGANIZATION=HBL MRB` to `STUDIO_DEFAULT_ORGANIZATION="HBL MRB"` and same for line 195
2. **Update ports throughout the generated `.env`**:
   - `API_EXTERNAL_URL` and `SUPABASE_PUBLIC_URL`: change `8000` → `8100`
   - `GOTRUE_SITE_URL` and `GOTRUE_URI_ALLOW_LIST`: change `3000` → `3200`
   - `SUPABASE_DB_URL` in app env: change `5432` → `5433`
   - `SAP_PROXY_PORT`: change `3002` → `3202`
   - `FRONTEND_PORT`: change `3000` → `3200`
3. **Add docker-compose.override.yml creation** after Supabase `.env` is written (step 4.5), to remap container ports:
   ```yaml
   services:
     kong:
       ports:
         - "8100:8000"
     db:
       ports:
         - "5433:5432"
   ```
4. **Update health check curl** in step 6 from port `8000` to `8100`

**File: `deploy/health-check.sh`**
- Update default Supabase API port reference from `8000` to `8100`
- Update middleware port check from `3002` to `3202`
- Update frontend port check from `3000` to `3200`

**File: `deploy/start.sh`**
- Update `SAP_PROXY_PORT` from `3002` to `3202`
- Update `SUPABASE_URL` from port `8000` to `8100`

**File: `deploy/deploy-edge-functions.sh`**
- Update `APP_DIR` to `/opt/MRB`
- Update `SUPABASE_DIR` to `/opt/supabase/docker`

### Manual deployment steps (after scripts are fixed)

```text
1. sudo bash deploy/setup-supabase.sh     # Docker + Supabase on 8100/5433
2. Run migrations against postgres on 5433
3. Deploy edge functions to /opt/supabase/docker/volumes/functions/
4. Build frontend: npm run build (with VITE_SUPABASE_URL=http://<IP>:8100)
5. Serve dist/ via Nginx on port 3200
6. Start SAP middleware on port 3202
7. Verify: sudo bash deploy/health-check.sh
```

### Files to modify
1. `deploy/setup-supabase.sh` — fix quoting bug + port/path updates
2. `deploy/health-check.sh` — port updates
3. `deploy/start.sh` — port updates
4. `deploy/deploy-edge-functions.sh` — path updates

