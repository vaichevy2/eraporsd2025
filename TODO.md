# TODO List

## Completed Tasks
- [x] Hide "Super Admin" row level from users with "Admin" role on the user data page
  - Modified `loadAdminUsers` function in `app.js`
  - Added logic to check current user's level
  - Filter out "Super Admin" rows when current user is not "Super Admin"

## Pending Tasks
- [ ] Test the implementation to ensure it works correctly
- [ ] Verify that Super Admin users can still see all rows including their own
- [ ] Verify that Admin users cannot see Super Admin rows
