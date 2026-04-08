

## Fix: Node.js Middleware Running on Port 3000

### No Code Changes Needed

The middleware port is **not hardcoded** in the application. It's stored in the `proxy_tunnel_url` field of each SAP API configuration in the database.

### What You Need to Do

In **SAP API Settings** (the page you're on now), update the **Node.js Middleware URL** for each API:

| API | Old URL | New URL |
|-----|---------|---------|
| ZMRB_Inward_Inspection | `https://your-ngrok-url.ngrok-free.app` | `https://your-ngrok-url.ngrok-free.app` (ngrok must tunnel to port **3000**) |
| MB52_Stock | same | same |
| 343_Unblock | same | same |
| 344_Block | same | same |

### Key Point

- **ngrok command**: Run `ngrok http 3000` (not `ngrok http 3002`)
- **Self-hosted proxy URL**: Use `http://10.10.4.178:3000` instead of `http://10.10.4.178:3002`
- **No database migration or code change is required** — just update the URL in the SAP API Settings UI

### If You Want a Database Update Instead

I can create a migration to update all `sap_api_config` rows, changing any `proxy_tunnel_url` references from port 3002 to 3000. Let me know if you'd prefer that approach.

