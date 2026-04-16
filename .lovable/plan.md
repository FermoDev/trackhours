

# Add Settings Page + Fix Empty Dropdowns

## Problem Summary
1. **Select dropdowns appear broken** — they're actually empty because there are no clients or projects in the database yet. The dropdowns work fine technically, but show nothing to select.
2. **No Settings page** exists in the sidebar for either role.
3. **Adding clients/projects** is only possible from admin pages — freelancers have no access.

## Changes

### 1. Add a Settings page (`src/routes/_authenticated.settings.tsx`)
- Profile settings: edit full name, hourly rate
- For admins: quick links to manage clients/projects
- Clean, minimal form layout

### 2. Add Settings to sidebar (`src/components/AppSidebar.tsx`)
- Add a Settings nav item (gear icon) for all users, placed before sign out

### 3. Seed initial data — add sample clients and projects
Use the database insert tool to add:
- 3 sample clients (e.g., "Acme Corp", "TechStart Inc", "Design Studio")
- 3-4 sample projects across those clients
This immediately fixes the "empty dropdown" experience.

### 4. Improve empty state on dashboard dropdowns
- When no clients/projects exist, show a helpful message in the dropdown like "No clients yet" with a link to admin/clients (for admins) or a note to contact admin (for freelancers)

## Technical Details

**New file:** `src/routes/_authenticated.settings.tsx`
**Modified:** `src/components/AppSidebar.tsx` (add Settings nav item)
**Modified:** `src/routes/_authenticated.dashboard.tsx` (empty state in SelectContent)
**Database:** Insert sample clients and projects via insert tool

