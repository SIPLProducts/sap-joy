## Answer: Yes — one small change needed

Your current `server.js` uses the generic `/proxy` endpoint, which is exactly what the new Q-Info Creation API will also route through (same pattern as all other SAP calls). So the endpoint itself needs no new route.

**However**, the new Q-Info API is hosted at `https://10.10.47.144:44300` with a **self-signed SSL certificate**. Your current axios call has no `httpsAgent`, so Node will reject the TLS handshake with `SELF_SIGNED_CERT_IN_CHAIN` / `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, and the frontend will see a 500 / network error.

This is the same fix discussed earlier for the Inward Inspection Lots timeout — it applies to **all HTTPS SAP endpoints on the new server**, including Q-Info.

---

## Proposed change to `server.js`

Add an `https` agent that accepts self-signed certs and pass it into the axios call inside `/proxy`:

```js
const https = require("https");

// Reusable agent for SAP endpoints with self-signed certs
const sapAgent = new https.Agent({ rejectUnauthorized: false });
```

Then inside `app.post("/proxy", ...)`, update the axios call:

```js
const sapRes = await axios({
  method: method || "GET",
  url,
  headers: sapHeaders,
  data: body,
  timeout: 30000,
  validateStatus: () => true,
  httpsAgent: sapAgent,   // ← add this line
});
```

That's the **only** change required. No new route, no new handler — the `/proxy` endpoint already forwards whatever `url` + `body` the frontend sends (which for Q-Info will be `https://10.10.47.144:44300/mrb/qinfo/create?sap-client=234` with the `MATNR / LIFNR / WERKS / REL_UDT` payload).

---

## Why nothing else needs to change

- **Auth**: You already build `Basic` auth from `auth.username / auth.password`. The frontend/edge function passes the same SAP creds already configured in `sap_api_config`.
- **Payload**: `/proxy` forwards `body` as-is via `data: body`, so the JSON `{MATNR, LIFNR, WERKS, REL_UDT}` goes through untouched.
- **Response parsing**: The edge function (`sap-sync` → `qinfo_create` action) is what inspects `MSGTYP: 'E'`. Middleware just needs to return the raw SAP body — which it already does.
- **Timeout**: 30s is enough for QI01; keep as-is.

---

## After deploying the change

1. Save `server.js`.
2. Restart: `node server.js` (or `Ctrl+C` and re-run — since you're not on PM2 in dev).
3. Test from the Quality Info screen: fill Material / Vendor / Plant → Submit.
4. If it still fails, check the middleware terminal — errors will now print the actual SAP response instead of an SSL handshake failure.
