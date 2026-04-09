

## Plan: Auto-Schedule Inward (ZMRB01) API Every 5 Minutes

### Current State
All 4 SAP APIs are set to `manual` sync with scheduling disabled:
- **ZMRB_Inward_Inspection** — stores data in `inward_inspection_lots` table
- **MB52_Stock_Report** — real-time live fetch (no local storage needed)
- **SAP_343** / **SAP_344** — transactional (action-based, no scheduled sync)

### What Changes

**1. Enable scheduler for ZMRB Inward only**
- Update `sap_api_config` for ZMRB: set `scheduler_enabled = true`, `sync_frequency = 'every_5_min'`
- MB52, 343, 344 remain `manual` / real-time — no changes

**2. Set up pg_cron to invoke the scheduler edge function every 5 minutes**
- The `sap-sync-scheduler` edge function already handles the full sync logic (lock, fetch from SAP via proxy, map fields, upsert into `inward_inspection_lots`)
- Create a `pg_cron` job: every 5 minutes, call the scheduler edge function via `pg_net`
- This replaces the need for any manual "Trigger Sync" clicks

**3. No code changes needed**
- The scheduler edge function already supports the `every_5_min` frequency and has built-in field mappings for ZMRB01
- The existing proxy-aware `callSAPApi` in the scheduler already wraps requests correctly for your `POST /proxy` middleware

### Summary
| API | Behavior | Scheduled? |
|-----|----------|-----------|
| ZMRB01 (Inward) | Auto-sync every 5 min → updates `inward_inspection_lots` | Yes |
| MB52 (Stock) | Live fetch on user action | No |
| 343 (Unblock) | Called on user action, response shown in UI | No |
| 344 (Block) | Called on user action, response shown in UI | No |

### Technical Steps
1. Use insert tool to UPDATE the ZMRB config row
2. Use insert tool to create a pg_cron scheduled job calling the edge function every 5 minutes
3. Verify the scheduler runs and populates data

