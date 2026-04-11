// sap-sync edge function entry point
// The actual logic lives in handler.ts (shared with the self-hosted router).
import handler from './handler.ts'

Deno.serve(handler)
