# Restrict "Data Guru Mapel" Access to Admin and Super Admin

## Tasks
- [x] Hide "Data Guru Mapel" menu in sidebar for non-admin users (rapor.html)
- [x] Add permission check in app.nav() function to prevent unauthorized access to 'gurumapel' page (app.js)
- [ ] Test access restrictions with different user levels

## Implementation Details
- Menu hiding: Added check for user level !== 'Admin' && user level !== 'Super Admin'
- Navigation check: Extended existing permission check to include 'gurumapel' page alongside 'siswa' and 'guru'
- User levels: 'Admin', 'Super Admin' (allowed), 'Guru' (denied)

## Summary
Successfully implemented access restrictions for "Data Guru Mapel" menu and page:
- Menu is hidden for non-admin users in the sidebar
- Navigation is blocked for unauthorized users with appropriate error messages
- Only Admin and Super Admin users can access teacher subject assignment data management
