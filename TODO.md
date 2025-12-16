# TODO - Fix Sync Users Issue

## Issue Description
When clicking "sinkronisasi pengguna" button in the "guru" table in the "data pengguna" page, it shows "sinkronisasi pengguna berhasil" but the page doesn't display data.

## Root Cause
The `syncUsers()` function was only calling `app.loadAdminUsers()` after synchronization, regardless of which tab (Admin or Guru) was active.

## Solution Implemented
Modified the `syncUsers()` function to check which tab is currently active and reload the appropriate data:
- If Guru tab is active: call `app.loadGuruUsers()`
- If Admin tab is active: call `app.loadAdminUsers()`

## Files Modified
- `app.js`: Updated `syncUsers()` function to conditionally reload data based on active tab

## Testing
- Click "sinkronisasi pengguna" in Guru tab → should now refresh Guru table
- Click "sinkronisasi pengguna" in Admin tab → should refresh Admin table
