The user wants the middleware `server.js` added to the Lovable project so it is tracked in git and can be downloaded/deployed from the repository. There is no `server.js` in the project today, which is why it does not appear in git.

## Goal
Create a `server.js` Express proxy middleware at the project root that is committed to git, handles the existing SAP proxy flow, and includes the `https.Agent({ rejectUnauthorized: false })` fix required for the new SAP Q-Info API and Inward Inspection Lots endpoints on the self-signed `10.10.47.144:44300` server.

## What I will create

1. `server.js` at project root
   - Express server with CORS and JSON body parsing.
   - `/proxy` endpoint that forwards any SAP URL/method/body to the configured SAP host using axios.
   - Builds Basic auth from the request body (`auth.username` / `auth.password`).
   - Injects the `https.Agent({ rejectUnauthorized: false })` agent so self-signed certificates from SAP do not cause handshake errors.
   - 30s timeout, returns raw SAP response body with status code.
   - Includes error handling/logging for connectivity and SSL failures.
   - Keeps the existing backward-compatible `/sap/api` and `/api/sap` routes mounted from `./routes/sapRoutes` (if the file exists; otherwise stubs the import).
   - Root route returns a health/status message.
   - Listens on `0.0.0.0` using `process.env.PORT || 3002`.

2. Update `.gitignore` (if needed)
   - Ensure `server.js` is not ignored; review current `.gitignore` for Node patterns.

3. Update `.lovable/plan.md`
   - Record that the middleware file is now part of the project and no longer only a manual patch.

## Technical details
- The `/proxy` endpoint is used by the existing `sapSyncClient` and the new `qinfo_create` edge-function action.
- For the Q-Info API the frontend/edge function will send:
  - URL: `https://10.10.47.144:44300/mrb/qinfo/create?sap-client=234`
  - Method: `POST`
  - Body: `{ MATNR, LIFNR, WERKS, REL_UDT, auth: { username, password } }`
- The `httpsAgent` change is the only fix required for the SSL error; no new routes or handlers are needed.

## After implementation
- The file will be in the project and tracked by git.
- You can run it locally with `node server.js`.
- In production you can deploy it alongside the Lovable frontend (or wherever the middleware currently runs).
- Remember to restart the middleware process after pulling the updated file.