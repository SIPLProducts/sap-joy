

## Plan: Align MRB Submit SAP 344 Call with Block Selected Button Logic

### Two Problems

**1. Logout on submit** — `invokeSapSync` (line 1379 of `sapSyncClient.ts`) calls `refreshSession()` unconditionally. If the refresh token is stale (common on long form sessions), the Supabase SDK fires a `SIGNED_OUT` event, logging the user out before the SAP call even happens.

**2. Response parsing mismatch** — The "Block Selected" button (in `ShopFloorStockSelection.tsx`) checks `resData?.CODE === '100'` and `resData?.result?.CODE === '100'`. The MRB Submit (in `ShopFloorMaterialBlocking.tsx`) checks `sapData?.record?.CODE` — a path that doesn't exist in the actual SAP response, so it always fails even when SAP returns success.

### Changes

**File 1: `src/lib/sapSyncClient.ts`** (lines 1377–1383)
- Remove the unconditional `refreshSession()` call
- Replace with: get session first, only refresh if token expires within 60 seconds
- Wrap refresh in try-catch so failure doesn't trigger logout
- Always proceed with existing token if refresh fails

```typescript
export async function invokeSapSync(body: Record<string, any>): Promise<{ data: any; error: any }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return { data: null, error: { message: 'Not authenticated. Please log in again.' } };
  }

  // Only refresh if token expires within 60 seconds
  const expiresAt = session.expires_at || 0;
  if (expiresAt - Math.floor(Date.now() / 1000) < 60) {
    try {
      await supabase.auth.refreshSession();
    } catch (e) {
      console.warn('[SAP Sync] Token refresh failed, proceeding with current token');
    }
  }
  // ... rest unchanged
```

**File 2: `src/pages/ShopFloorMaterialBlocking.tsx`** (lines 259–271)
- Align response parsing with the working "Block Selected" pattern from `ShopFloorStockSelection.tsx`
- Check `sapData?.CODE`, `sapData?.result?.CODE`, and `sapData?.success` (same as Block Selected)
- Extract MBLNR from `sapData?.MBLNR`, `sapData?.result?.MBLNR`, `sapData?.data?.MBLNR`

Replace:
```typescript
const sapCode = sapData?.record?.CODE || sapData?.CODE;
const sapMblnr = sapData?.record?.MBLNR || sapData?.MBLNR;
if (sapError || sapCode !== '100' || !sapMblnr) {
```

With:
```typescript
const isSuccess = sapData?.success || sapData?.CODE === '100' || sapData?.result?.CODE === '100';
const sapMblnr = sapData?.MBLNR || sapData?.result?.MBLNR || sapData?.data?.MBLNR || '';
if (sapError || !isSuccess) {
```

### Result
- No more unexpected logouts during MRB submission
- MRB Submit uses the exact same SAP 344 call and response parsing as the working "Block Selected" button
- MRB record is created only after SAP confirms success (CODE 100)

