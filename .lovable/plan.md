# Verify Auth Email Flows End-to-End

Run automated Playwright tests against the live preview to exercise each auth email flow, then confirm delivery via `email_send_log` in the database.

## Flows to verify

1. **Sign up** — create a new test user, confirm confirmation email is enqueued and sent.
2. **Login verification** — attempt login before confirming email (should fail with `email_not_confirmed`), then simulate/verify the confirmation link works.
3. **Forgot password** — trigger password reset from the login page, confirm recovery email is sent, verify `/reset-password` page loads with recovery token and accepts a new password.
4. **Logout** — sign in, sign out, confirm session cleared (no email expected — logout doesn't send email; will confirm this is expected behavior).

## How each flow is checked

For each flow:
- Drive the UI via Playwright (headless Chromium at `localhost:8080`), screenshot each step.
- After the action, query `email_send_log` filtered by recipient + template_name, deduplicated by `message_id`, to confirm status is `sent` (not `pending`, `dlq`, `failed`, or `suppressed`).
- Inspect `error_message` on any non-sent row and report it.

## Test accounts

Use unique throwaway emails per run (e.g. `test+<timestamp>@example.com`). Do not test with real user inboxes. Cleanup: delete created test users from `auth.users` at the end.

## Reset-password page check

Verify `/reset-password` route exists and is publicly accessible (not behind auth gate). Confirm it reads `type=recovery` from URL hash and calls `supabase.auth.updateUser({ password })`.

## Deliverable

A summary report per flow:
- ✅/❌ UI action succeeded
- ✅/❌ Email row present in `email_send_log` with status `sent`
- Any error messages or misconfigurations found
- Recommendations if a flow is broken

## Notes

- No code changes unless a broken flow is discovered — in which case I'll stop, report, and ask before fixing.
- Auth email TTL is 15 minutes; tests run immediately after enqueue to avoid expiration.
