# TODO: Perbaiki Animasi Loading "Menyimpan Data TP"

## Task Description
Fix the loading animation for saving TP (Tujuan Pembelajaran) data.

## Analysis
- The loading modal was using Bootstrap's `spinner-border` which may not display properly.
- The CSS already defines a custom `.loading-spinner` with multiple `.spinner-ring` elements for a layered spinning effect.
- The `saveCPTP` function in app.js calls `app.showLoading('Menyimpan data TP...')` to display the loading animation.

## Changes Made
- [x] Updated `modalLoading` in rapor.html to use the custom `.loading-spinner` instead of Bootstrap's `spinner-border`.
- [x] The custom spinner consists of 4 concentric rings with different animation delays for a smooth layered effect.

## Testing
- The loading animation should now display properly when saving TP data.
- The animation uses CSS keyframes for smooth rotation with staggered delays.

## Status
✅ **COMPLETED** - Loading animation fixed and should now display correctly.
