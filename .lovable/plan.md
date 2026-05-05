I found two likely causes for the on-prem issue:

1. The In-Process page may be selecting the wrong active SAP config. It currently chooses the newest active config whose name contains `process`; if the self-hosted database still has older/duplicated configs or incomplete mappings, it can sync SAP successfully but write nothing to `zmrb_inward_report`.
2. The self-hosted migration path is inconsistent (`/opt/MRB` vs `/opt/MRB_NEW`), so the patch may not actually be applied to the database used by the deployed app.

Plan to fix:

1. Harden the In-Process API config selection
   - Update `src/pages/InwardInProcessReport.tsx` to explicitly prefer `ZMRB_Inward_Process`.
   - Require the chosen config to have response mappings to `zmrb_inward_report`.
   - Avoid falling back to `ZMRB_Inward_Inspection`, because that config maps to `inward_inspection_lots` and will not show on the In-Process screen.
   - If no valid config exists, show a clear toast/message instead of silently using the wrong config.

2. Harden self-hosted client-side sync mapping
   - Update `src/lib/sapSyncClient.ts` so manual sync reports accurate inserted vs updated counts for `zmrb_inward_report`, not just returned row count.
   - Add safer SAP field aliases for known In-Process fields such as `SELLIFNR`, `KDAUF`, `KDPOS`, `GRN_ITEM_NO`, and existing direct DB column aliases.
   - Improve returned error details when all fetched rows are dropped due to missing mapped required fields, so future failures show exactly which SAP keys were received.

3. Fix the self-hosted SQL patch so it applies to existing installations reliably
   - Add a new idempotent migration that:
     - Ensures `zmrb_inward_report` table/columns/index/RLS exist.
     - Ensures `ZMRB_Inward_Process` config exists and is active.
     - Ensures all `ZMRB_Inward_Process` request fields are present with `ART='04'`.
     - Replaces/repairs response mappings for that config so mapped fields target `zmrb_inward_report`.
     - Sets old `ZMRB_Inward_Inspection` inactive for In-Process screen usage only if needed, or leaves it active but prevents the In-Process page from selecting it.
   - Generate a standalone SQL file in `/mnt/documents/` for direct application on the on-prem server.

4. Fix deployment script path inconsistency
   - Align `deploy/setup-db.sh`, `deploy/start.sh`, `deploy/restart.sh`, `deploy/deploy-edge-functions.sh`, and related scripts to use a single app directory convention.
   - Based on the current install/update scripts, I will standardize to `/opt/MRB_NEW` unless the existing scripts already have a safe env override.
   - Add an override variable pattern like `APP_DIR="${APP_DIR:-/opt/MRB_NEW}"` so future installs can still customize.

5. Provide exact on-prem verification commands
   - Include SQL checks to verify:
     - Which SAP config the In-Process page should use.
     - How many response mappings point to `zmrb_inward_report`.
     - Whether the last sync history contains hidden errors.
     - Whether rows exist in `zmrb_inward_report`.
   - Include restart/rebuild commands so the browser uses the updated client code.

After approval, I will implement the code changes, create the new migration and downloadable SQL patch, and provide the exact commands to run on your on-prem server.