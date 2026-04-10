

## Fix: Edge Function Handler Wrapper for Self-Hosted Supabase

### Root Cause

The Python handler-generation logic in `deploy-edge-functions.sh` has a fundamental flaw: it uses `rfind(');')` to remove the closing of `Deno.serve()`, but this targets the **last** `);` in the file — which is wrong for functions that have helper code **after** the `Deno.serve()` block.

**Affected functions and why:**

| Function | Structure | Result |
|---|---|---|
| `create-user` | `Deno.serve` closes on last line | Works (correct `);` removed) |
| `sap-sync-scheduler` | Similar simple structure | Works |
| `sap-sync` | ~700 lines of helper functions AFTER `Deno.serve()` closes at line 570 | **Broken** — wrong `);` removed, corrupts a helper function |
| `send-mrb-email` | `Deno.serve` closes on last line BUT uses `npm:nodemailer` | **Broken** — `npm:` imports may fail in bundled router context |
| `test-smtp` | Same `npm:nodemailer` issue | **Broken** — same import issue |
| `seed-demo-users` | Uses old `serve()` from `deno.land/std` | **Broken** — pattern works but `);` removal may be wrong |

### Fix: Rewrite the Python handler generator

Instead of the fragile `rfind(');')` approach, use a **proper brace-matching algorithm**:

1. Find the position where `Deno.serve(` or `serve(` starts
2. Track opening/closing braces and parens to find the exact closing `)`
3. Extract the handler function body (the arrow function inside serve)
4. Keep all code before and after the serve block (imports, helpers) intact
5. Replace the `Deno.serve(handler)` call with `export default handler`

### Changes

**File: `deploy/deploy-edge-functions.sh`** — Replace the Python handler generator (lines 76-124) with a more robust algorithm that:

1. Finds the `Deno.serve(` or `serve(` call position
2. Extracts the `async (req) => { ... }` handler by matching balanced braces/parens
3. Outputs: all imports + constants + `export default async (req: Request) => { ... }` + all helper functions that were defined outside serve
4. For `npm:` imports (nodemailer): keeps them as-is since the Deno edge runtime supports `npm:` specifiers natively when each handler file is imported

### Deployment steps (on your server)

```text
1. Pull latest code:
   cd /opt/MRB_NEW/sap-joy && git pull

2. Run the updated deploy script:
   sudo bash deploy/deploy-edge-functions.sh

3. Check container logs if any function still fails:
   docker logs supabase-new-edge-functions --tail 50

4. Test each endpoint:
   curl -X POST http://10.10.4.178:8100/functions/v1/test-smtp \
     -H "Authorization: Bearer <anon_key>" \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
```

