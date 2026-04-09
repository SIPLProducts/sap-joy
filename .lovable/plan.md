
Goal: provide a complete local Node.js proxy you can copy onto your system, run behind ngrok, and use with the current app in both Lovable Cloud and self-hosted deployments.

What I found in the codebase
- The app already expects a middleware URL from `sap_api_config.proxy_tunnel_url` plus `endpoint_path`.
- Required routes are:
  - `POST /sap/api/zmrb01`
  - `POST /sap/api/mb52`
  - `PUT /sap/api/343`
  - `GET or PUT /sap/api/344`
- The app sends:
  - `x-proxy-secret`
  - `Authorization: Basic ...`
  - `sap-client`
  - `ngrok-skip-browser-warning`
- The app may call through:
  - Lovable Cloud -> backend function -> ngrok -> Node proxy
  - Self-hosted frontend -> direct browser -> Node proxy
- Current docs still mention port 3002 in places, but your latest runtime target is port 3000.

Plan
1. Deliver a production-ready Node.js proxy package
- `server.js` with Express
- middleware for CORS, JSON parsing, request logging, timeout handling
- `x-proxy-secret` validation
- health route `/health`
- all 4 SAP routes matching the app’s expected paths

2. Match the app’s payload/header behavior
- Forward `Authorization`, `sap-client`, and proxy headers
- Accept request body exactly as the app sends it
- Preserve POST/PUT/GET semantics expected by `sapSyncClient.ts` and `sap-sync`
- Support ngrok safely by allowing `ngrok-skip-browser-warning`

3. Implement resilient SAP forwarding
- Build SAP target URL from environment variables
- Forward query params for GET routes
- Forward JSON bodies for POST/PUT
- Return JSON when SAP returns JSON
- Return text/error payloads without crashing when SAP responds with HTML or empty body
- Keep timeout aligned with app expectations

4. Cover each app use case
- ZMRB01 inward fetch
- MB52 live stock search
- 343 unblock transaction
- 344 transaction / quantity update compatibility
- Include a fallback so `/sap/api/344` works for both GET and PUT styles if your SAP side varies

5. Provide copy-paste setup details
- `package.json`
- `.env` example
- install command
- run command
- PM2 command
- ngrok command for port 3000
- exact values to place in SAP API Settings:
  - connection mode
  - proxy URL
  - proxy secret
  - endpoint paths

Recommended deliverables
I will prepare the proxy as these copy-ready files:
- `server.js`
- `package.json`
- `.env.example`

Suggested runtime configuration
```text
PORT=3000
PROXY_SECRET=<same value as SAP API Settings proxy_secret>
SAP_BASE_URL=<your SAP host/base URL>
SAP_USERNAME=<optional fallback username>
SAP_PASSWORD=<optional fallback password>
SAP_CLIENT=234
REQUEST_TIMEOUT_MS=30000
ALLOW_ORIGIN=*
```

Expected route mapping
```text
Client/App                  Node Proxy                 SAP
POST /sap/api/zmrb01   ->   forward inward call   ->  ZMRB inward endpoint
POST /sap/api/mb52     ->   forward stock call    ->  MB52 endpoint
PUT  /sap/api/343      ->   forward unblock       ->  343 movement endpoint
GET/PUT /sap/api/344   ->   forward block/update  ->  344 movement endpoint
GET  /health           ->   health check          ->  local proxy status only
```

Technical details to follow in the code
- Use Express + Axios
- Validate `x-proxy-secret` before calling SAP
- Use incoming Basic Auth if present; otherwise fall back to env credentials
- Pass through `sap-client` from header or env fallback
- Normalize empty SAP responses into a JSON object instead of raw blank output
- Log request path, upstream URL, status, and elapsed time
- Handle both JSON and XML/HTML/text error responses cleanly
- Add CORS support for Lovable preview and self-hosted frontend

Important deployment notes
- Run ngrok against the Node proxy port only:
  - `ngrok http 3000`
- In Lovable Cloud development:
  - set `proxy_tunnel_url` to your ngrok HTTPS URL
- In self-hosted production:
  - set `proxy_tunnel_url` to your LAN URL, for example `http://10.10.4.178:3000`
- Keep `endpoint_path` exactly as the app expects:
  - `/sap/api/zmrb01`
  - `/sap/api/mb52`
  - `/sap/api/343`
  - `/sap/api/344`

One important clarification before implementation
The app route names are clear, but the actual upstream SAP OData URLs are not present in this repo. So the proxy code should be built in one of these two ways:
- Option A: one env variable per upstream SAP endpoint
- Option B: one SAP base URL plus hardcoded upstream path map inside `server.js`

I recommend Option A because it is safer and easier to change without editing code.

Final implementation shape
- I will provide a single complete proxy server that is ready to paste into your local system.
- It will be compatible with ngrok and your current app routing.
- It will not require app code changes if your SAP API Settings already point to port 3000 and the correct endpoint paths.

Next build step
After approval, I should generate the exact copy-paste Node.js files with:
- full `server.js`
- full `package.json`
- full `.env.example`
- exact startup commands
- PM2 command
- ngrok command
- testing examples for all 4 routes

<lov-actions>
<lov-suggestion message="Test the Node.js proxy end-to-end with ngrok and verify all four SAP routes respond correctly from the app.">Verify that it works</lov-suggestion>
<lov-suggestion message="Generate the complete copy-paste Node.js proxy code now, including server.js, package.json, and .env.example for port 3000 and ngrok support.">Generate proxy code</lov-suggestion>
<lov-suggestion message="Provide the exact SAP API Settings values I should enter for MB52, 343, 344, and ZMRB01 when using ngrok on port 3000.">Give API settings values</lov-suggestion>
<lov-suggestion message="Create a PM2 startup and restart guide for the local Node.js proxy, including logs and health check commands.">Add PM2 setup guide</lov-suggestion>
<lov-suggestion message="Show me sample curl requests to test /sap/api/zmrb01, /sap/api/mb52, /sap/api/343, and /sap/api/344 through the local proxy and ngrok.">Add test commands</lov-suggestion>
</lov-actions>
