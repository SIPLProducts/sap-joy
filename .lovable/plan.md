

## Problem

The error `Cannot read properties of undefined (reading 'digest')` occurs because `crypto.subtle` is **only available in secure contexts** (HTTPS or `localhost`). Your self-hosted Supabase deployment is likely served over HTTP, so `crypto.subtle` is `undefined`.

The `hashPasswordForHistory()` function in `src/lib/passwordPolicy.ts` uses `crypto.subtle.digest('SHA-256', ...)` which fails on HTTP deployments.

## Solution

Replace the Web Crypto API (`crypto.subtle`) with a pure JavaScript SHA-256 implementation that works in any context (HTTP or HTTPS). We'll use a simple inline SHA-256 function — no new dependencies needed.

## Changes

### 1. Update `src/lib/passwordPolicy.ts` — Replace `hashPasswordForHistory`

Replace `crypto.subtle.digest` with a pure JS SHA-256 implementation using a fallback approach:
- Try `crypto.subtle.digest` first (works on HTTPS)
- If unavailable, use a bundled pure-JS SHA-256 function

This ensures the password history check works on both HTTPS and HTTP self-hosted deployments.

### 2. No other files need changes

`UserManagement.tsx` already imports and calls `hashPasswordForHistory` — the fix is entirely within the utility function.

## Technical Detail

The fallback will implement SHA-256 using standard bitwise operations (the same algorithm, just not relying on the browser's native crypto API). This is safe for password history comparison purposes (not used for authentication — that's handled by `pgcrypto` in the database).

