# Fix "require is not defined" when running the SAP middleware

## Why it fails
The project says "treat every .js file as a modern module". Your `server.js` was half-converted: the first line (dotenv) now uses `import`, but line 6 onward still uses the old `require(...)` style, so Node stops at line 6. The helper file `routes/sapRoutes.js` has the same old style.

## What will change
1. Rewrite `server.js` fully in the modern `import` style. Same behaviour as today:
   - `/proxy` endpoint, CORS, 50 MB body limit, request logging
   - Accepts self-signed SAP certificates
   - SAP timeout: uses `timeout` from the request if given, otherwise no limit (0), so slow SAP queries stop timing out at 30 s
   - Port 3002 (or `PORT` from .env)
2. Rewrite `routes/sapRoutes.js` in the same style (still optional; server runs even if missing).
3. No changes to the app screens, database, or any other logic.

## How you run it afterwards
```powershell
npm install dotenv express cors body-parser axios
node server.js
```
Expected output: `Server running on port 3002`.

If you previously renamed a copy to `server.cjs`, delete it so only `server.js` is used. On the production server, restart PM2 after pulling: `pm2 restart all`.

## Technical details
- `import "dotenv/config"`, `import express from "express"`, etc.
- Legacy routes loaded with `await import("./routes/sapRoutes.js")` inside try/catch.
- `sapRoutes.js` uses `export default router`.
