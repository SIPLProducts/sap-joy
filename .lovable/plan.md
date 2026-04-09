

## Plan: Generate Zero-Config Generic Node.js Proxy

### The Problem
Your current proxy code has **one route**: `POST /proxy` that expects the full SAP URL inside the request body (`req.body.url`).

But the app calls the proxy like this:
```text
POST https://ngrok-url/sap/api/zmrb01?sap-client=234
Headers: Authorization: Basic xxx, x-proxy-secret: xxx, sap-client: 234
Body: { ...SAP request payload... }
```

The proxy receives `POST /sap/api/zmrb01` → has no handler for it → returns **404 Not Found**.

### The Fix
Replace the single `/proxy` route with a **wildcard handler** that:
1. Accepts ANY path (`/*`)
2. Validates `x-proxy-secret` from headers
3. Combines `SAP_BASE_URL` (the only env var) + the incoming request path + query string to build the real SAP URL
4. Forwards the method, body, `Authorization`, and `sap-client` headers to SAP
5. Returns SAP's response as-is

### How It Will Work

```text
App sends:  POST https://ngrok-url/sap/api/zmrb01?sap-client=234
            Headers: Authorization: Basic xxx, x-proxy-secret: secret123

Proxy receives path: /sap/api/zmrb01?sap-client=234
Proxy builds:  SAP_BASE_URL + /sap/api/zmrb01?sap-client=234
               = http://sap-server:8000/sap/api/zmrb01?sap-client=234
Proxy forwards request to SAP with same method, body, and auth headers
```

### Files to Generate (copy to local system)

**1. `server.js`** (~80 lines)
- Express with CORS, JSON parsing
- `x-proxy-secret` validation middleware
- `/health` endpoint (no auth)
- Wildcard `app.all('/*', ...)` that forwards to `SAP_BASE_URL + req.originalUrl`
- Forwards `Authorization`, `sap-client`, `Content-Type` headers
- Handles JSON and non-JSON SAP responses
- Request logging with timing
- SSL certificate bypass for SAP (`rejectUnauthorized: false`)

**2. `package.json`** — express, axios, cors, dotenv

**3. `.env.example`**
```
PORT=3000
PROXY_SECRET=7d9f2e1b4a5c8e3d6f1g0h2j4k6l8m0n
SAP_BASE_URL=http://your-sap-server:8000
```

Only 3 env vars. No SAP credentials, no sap-client, no endpoint paths — all come from the UI.

### No App Code Changes
The Edge Function `buildUrl()` already constructs `proxy_tunnel_url + endpoint_path`. The `sapSyncClient.ts` `invokeDirect()` does the same. Both send credentials as headers. The new proxy just needs to forward them.

### Deployment
```bash
npm install
cp .env.example .env   # set SAP_BASE_URL and PROXY_SECRET
node server.js          # or: pm2 start server.js --name sap-proxy
ngrok http 3000
```

### Technical Details
- The wildcard catches all 4 current APIs (zmrb01, mb52, 343, 344) and any future ones added via the UI
- Query params (like `?sap-client=234`) are preserved via `req.originalUrl`
- Uses `axios` with `rejectUnauthorized: false` for SAP's self-signed certs
- 60-second timeout matching your current proxy
- Returns structured error JSON on failure

