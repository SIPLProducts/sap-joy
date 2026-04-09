

## Plan: Add Deployment Mode Selector with Auto-Port Configuration

### What Changes

**Single file: `src/components/sapApi/SAPApiEditForm.tsx`**

1. **Add a "Deployment Mode" dropdown** above the Connection Mode field with two options:
   - **Cloud (Lovable Preview)** — sets default port to `3000`, shows ngrok URL guidance
   - **Self-Hosted (Client Server)** — sets default port to `3002`, shows LAN IP guidance

2. **Add a "Middleware Port" input field** next to the deployment mode selector, pre-filled based on the selected mode (3000 for Cloud, 3002 for Self-Hosted), but editable so the user can override.

3. **Auto-build the middleware URL** when the user changes deployment mode or port:
   - Cloud: placeholder shows `https://abc.ngrok-free.app` (port is embedded in ngrok URL, so port field is hidden)
   - Self-Hosted: placeholder shows `http://10.10.4.178:{port}` and `http://host.docker.internal:{port}`

4. **Update help text** dynamically based on the selected deployment mode — Cloud shows ngrok instructions, Self-Hosted shows LAN IP / Docker instructions with the correct port.

5. **Store deployment mode** — save it as part of the connection_mode or as a new state variable used only for UI guidance (no DB schema change needed since the final `proxy_tunnel_url` already captures the full URL with port).

### UI Layout

```text
┌─────────────────────────────────────────────┐
│ Connection Mode    │ Via VPN Tunnel  ▼       │
├─────────────────────────────────────────────┤
│ Deployment Mode    │ ○ Cloud (Preview)       │
│                    │ ● Self-Hosted (Client)  │
├─────────────────────────────────────────────┤
│ Middleware Port    │ [ 3002 ]                │
│                    │ Cloud=3000, Self=3002   │
├─────────────────────────────────────────────┤
│ Node.js Middleware │ [ http://10.10.4.178:3002 ] │
│ URL                │ Base URL only, no /proxy│
└─────────────────────────────────────────────┘
```

### Technical Detail
- New local state: `deploymentMode` (`'cloud' | 'selfhosted'`), initialized by detecting if existing `proxy_tunnel_url` contains `ngrok` or a private IP
- When deployment mode changes, auto-update the port field and placeholder text
- The middleware URL input remains fully editable — the deployment mode just provides smart defaults
- No database migration needed — the final saved value is still `proxy_tunnel_url`
- Also update the info card in `src/pages/SAPApiSettings.tsx` to show port `3002` for self-hosted examples

