# Smart Time Reminders

## Goal
Make logging time less tedious by nudging people at the right moment and letting them act in one click. Focus on manual entries — that's what everyone actually uses.

## What we'll build

### 1. Daily in-app nudge (dashboard)
- If the signed-in user has logged no time today, show a dismissible banner at the top of the dashboard.
- One action: "Log time now" — opens the manual-entry dropdown, pre-filled with the user's most recent client/project and today's date.
- Dismissing hides it for the rest of the day.

### 2. Daily browser notification
- New "Reminders" section in Settings: turn the daily reminder on/off and pick a time (default 5:00 PM).
- When the chosen time passes and the app is open in a tab, show a browser notification: "You haven't logged time today." Clicking it focuses the tab and opens the manual-entry form.
- Asks for notification permission when the user turns it on; if permission is blocked, falls back to an in-app toast.
- Never fires on a day the user already logged time.

### 3. Month-end email reminders
- Starting 5 days before the end of each month, email users who have unlogged gaps so they can catch up before month close.
- One email per user per day, sent from your verified sender domain, only on the last 5 days of the month.
- Email content: how many hours they've logged this month, which days in the month have zero entries, and a button that opens the app straight to the manual-entry form.
- Skips users who logged time on every weekday that month, and skips inactive accounts.
- Users can turn month-end emails off in Settings (same Reminders section).

## Not doing
- Timer-based suggestions or quick-resume chips (nobody uses the timer).
- Client-facing reminders — internal team only.

## Technical approach

**Reminder settings**
- New `reminder_settings` table keyed by `user_id`: `daily_enabled`, `daily_time`, `month_end_email_enabled`, timestamps. RLS so a user reads/writes only their own row; row auto-created on first save with sensible defaults.

**In-app + browser notifications**
- New `src/lib/reminders.ts`: permission request, "logged anything today?" check, and a timer that fires at the user's chosen local time while the app is open.
- Dashboard banner reuses the today-minutes value the dashboard already loads.
- Dismissal stored per-day in local storage.

**Month-end emails**
- Email infrastructure and the verified sender domain (`notify.trackhourspro.com`) are already in place; this adds one new template plus a sending path.
- New React Email template `src/lib/email-templates/month-end-reminder.tsx` registered in the template registry, styled to match the app (green accent, Inter).
- A scheduled daily job runs once per day; it exits immediately unless the date is within the last 5 days of the month. For each eligible user it computes month-to-date hours and missing weekdays, then queues one email. Runs once daily, so no meaningful ongoing cost.
- An idempotency key per user per day prevents duplicate sends if the job runs twice.

**Files to touch**
- `src/routes/_authenticated.settings.tsx` — Reminders section.
- `src/routes/_authenticated.dashboard.tsx` — nudge banner + prefilled manual entry.
- `src/lib/reminders.ts` — new.
- `src/lib/email-templates/month-end-reminder.tsx` + registry — new template.
- Server route for the daily reminder job + scheduled trigger.
- Database migration for `reminder_settings`.

## Acceptance criteria
- A user with no entries today sees the dashboard banner, and clicking it opens a prefilled manual-entry form.
- Turning on the daily reminder in Settings asks for permission and confirms with a test notification.
- The daily notification fires at the chosen time only when no time was logged that day.
- On each of the last 5 days of a month, users with gaps get exactly one reminder email showing their month-to-date hours and missing days.
- Turning month-end emails off in Settings stops those emails.
