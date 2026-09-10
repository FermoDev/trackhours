# Smart Time Reminders

## Goal
Make logging time less tedious by nudging users at the right moment and letting them act in one click, instead of forcing them to remember the app exists.

## What we'll build

1. **Daily in-app nudge**
   - Show a dismissible banner on the Dashboard when the signed-in user has logged zero time today.
   - Banner offers two one-click actions:
     - "Start timer on last project" — resumes the most recent client/project combo.
     - "Log 30 min manually" — opens the manual-entry popover pre-filled with the last project and today's date.

2. **Browser notification reminder**
   - Add a Reminders section in Settings.
   - User can enable/disable a daily browser notification and pick a time (default 17:00 / 5 PM).
   - When the chosen time arrives and the app is open, request Notification permission if needed and show a browser notification: "You haven't logged time today — start timer or log time?"
   - Clicking the notification focuses the tab and opens the relevant action.
   - If permission is denied, fall back to an in-app toast reminder.

3. **Smart suggestions row**
   - On the Dashboard, below the primary buttons, show "Quick resume" chips for the user's last 3 unique client/project combos from the past 14 days.
   - Clicking a chip prefills and opens the Start timer popover.

## Out of scope for this plan
- Email reminders (can be added later; browser notifications cover the open-app case).
- Admin-controlled reminder policies (users own their own reminder settings).

## Technical approach

- Add `reminder_enabled` and `reminder_time` columns to `public.profiles` (or a new `reminder_settings` table if we want to keep profile lean). RLS: users read/update only their own row.
- Use the existing browser Notification API; no service worker needed for page-visible notifications.
- Schedule the check with a lightweight `setInterval`/`setTimeout` based on the user's chosen local time, refreshed when the setting changes.
- Quick-resume chips reuse the existing recent-entries logic already present on the Dashboard.
- The zero-time-today banner queries the same `time_entries` data the Dashboard already fetches.

## Files to touch
- `src/routes/_authenticated.settings.tsx` — add reminder toggles/time picker.
- `src/routes/_authenticated.dashboard.tsx` — add nudge banner and quick-resume chips.
- `src/lib/reminders.ts` — new helper for permission request, notification content, and scheduling.
- Database migration — add reminder columns to `profiles` with RLS update policy.

## Acceptance criteria
- A user with no entries today sees the dashboard banner.
- Banner actions correctly start a timer or open the manual-entry popover.
- Enabling reminders in Settings requests browser permission and shows a test notification.
- At the chosen time, an enabled user receives a browser notification if the app is open and no time was logged that day.
- Quick-resume chips show recent client/project combos and prefill the timer popover.
