
Two small UI tweaks:

1. **Sidebar order** (`src/components/AppSidebar.tsx`): Move "Settings" out of `freelancerNav` so it appears at the very bottom of the nav list (after admin items for admins, after timesheet items for freelancers). I'll render it as a separate item appended after both nav groups.

2. **Dashboard button label** (`src/routes/_authenticated.dashboard.tsx`): Change the "Forgot to track?" button text to "Manual entry". The icon and behavior stay the same.

No database or logic changes needed.
