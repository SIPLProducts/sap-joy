# Fix: Self-Signed SSL Certificate Error on SAP Calls

## Problem
When testing the Inward Inspection Lots API, the middleware on your laptop rejects the SAP server's self-signed HTTPS certificate (`https://10.10.47.144:44300`). Node.js by default validates certs and throws `DEPTH_ZERO_SELF_SIGNED_CERT`, which then surfaces in the app UI as a failed test.

The root fix lives in your **Node.js middleware** (on your laptop). We'll also improve the app side so the error is clearer and optionally configurable per API.

---

## Part 1 — Middleware fix (your laptop, outside this repo)

Update the outbound HTTPS call inside your proxy (`index.js` or equivalent) so it does not validate self-signed certs for SAP.

**If using axios:**
```js
const https = require('https');
const sapAgent = new https.Agent({ rejectUnauthorized: false });

await axios({
  method, url, data, headers,
  httpsAgent: sapAgent,
  timeout: 60000,
});
```

**If using node-fetch v2:**
```js
const https = require('https');
const sapAgent = new https.Agent({ rejectUnauthorized: false });
await fetch(url, { agent: sapAgent, ... });
```

**Quick test (dev only):** restart the middleware with
`NODE_TLS_REJECT_UNAUTHORIZED=0` set in the environment.

Then PM2 restart: `pm2 restart mrb-app`.

---

## Part 2 — App-side improvements (this repo)

### 2A. Clearer error surfacing
In `supabase/functions/sap-sync/handler.ts` (and the test path), detect SSL-related error strings from the proxy response and rewrite the toast message to something actionable:

- Detect substrings: `self signed certificate`, `DEPTH_ZERO_SELF_SIGNED_CERT`, `SELF_SIGNED_CERT_IN_CHAIN`, `unable to verify the first certificate`, `CERT_HAS_EXPIRED`.
- Return a `{ ok:false, error: "SAP SSL certificate not trusted by middleware. Restart middleware with rejectUnauthorized:false or install the SAP cert." }` payload (still HTTP 200, per Core rule).

### 2B. Per-API "Allow self-signed certificate" toggle (optional but recommended)
- Add a boolean column `allow_self_signed` to `sap_api_config` (default `true` for on-prem; false for cloud).
- Surface it in `SAPApiEditForm.tsx` under the Connection section.
- Edge function forwards the flag to the middleware in the `/proxy` payload as `insecureTLS: true`.
- Middleware uses the flag to decide whether to attach the `rejectUnauthorized:false` agent (safer than a global env flag).

### 2C. Update SAP Connectivity Guide
Add a short "Self-signed SAP certificate" section in `src/components/sapApi/SAPConnectivityGuide.tsx` with the axios/fetch snippet above and the `NODE_TLS_REJECT_UNAUTHORIZED=0` workaround.

---

## Technical details

- No DB changes are required for Part 2A — purely error-message mapping.
- Part 2B adds one migration (column + grant unchanged on existing table) and minor UI/edge-function edits.
- Edge function continues to return HTTP 200 JSON `{ok, error, data}` per project rule.
- No change to SAP payload format, ART field padding, or date format rules.

---

## What I will NOT change
- SAP credentials, URL host, or client number — those remain as configured.
- Workflow routing, MRB logic, or any unrelated screens.

---

## Recommended next step
1. Apply Part 1 on your laptop first and retest — this alone should resolve the immediate error.
2. If you want the in-app safeguards (clearer message + per-config toggle), I'll implement Part 2A + 2B + 2C when you switch to build mode.

Confirm which parts you want me to implement (Part 2A only, or 2A+2B+2C), and I'll proceed.
