

## Fix: Update deploy/start.sh to launch the Deno scheduler

### Problem
`deploy/start.sh` section [2/2] looks for `$BACKEND_DIR/scheduler.js` (a Node.js file) — but it doesn't exist. The real scheduler is a Deno TypeScript file at `supabase/functions/sap-sync-scheduler/index.ts`.

### What changes

**File: `deploy/start.sh`** — Replace section [2/2] (the scheduler block) so it:
- Points to the correct Deno edge function path: `$APP_DIR/supabase/functions/sap-sync-scheduler/index.ts`
- Uses `deno run --allow-net --allow-env --allow-read` instead of Node.js via PM2
- Passes `SUPABASE_URL` (derived from `VITE_SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY` as environment variables
- Still uses PM2 for process management (PM2 can manage Deno processes via `--interpreter`)
- Keeps the same PM2 process name `mrb-scheduler-new` and log path

**Updated scheduler section will look like:**
```text
SCHED_FILE="$APP_DIR/supabase/functions/sap-sync-scheduler/index.ts"

if [ -f "$SCHED_FILE" ]; then
  echo "[2/2] Starting Deno Scheduler..."
  pm2 delete mrb-scheduler-new 2>/dev/null || true

  SUPABASE_URL="${SUPABASE_URL:-$VITE_SUPABASE_URL}" \
  SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}" \
  pm2 start "$SCHED_FILE" \
    --name mrb-scheduler-new \
    --interpreter deno \
    --interpreter-args "run --allow-net --allow-env --allow-read" \
    --log "$LOG_DIR/scheduler.log" \
    --time \
    --env production \
    --cron-restart "0 */6 * * *"

  echo "  ✓ Deno scheduler started on port ${SCHEDULER_PORT:-3100}"
else
  echo "[2/2] ⚠ Scheduler not found at $SCHED_FILE"
fi
```

### Key details
- `SUPABASE_URL` is set from `VITE_SUPABASE_URL` if not already defined — this prevents the port mismatch (8001 vs 8100) that caused the original failure
- The Deno function already reads `PORT` env (defaults to 3100) and `SUPABASE_SERVICE_ROLE_KEY`
- No new files needed — just fixing the existing `deploy/start.sh`

