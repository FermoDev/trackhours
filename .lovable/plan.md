## What went wrong

During the earlier debugging pass I turned on auto-confirm at the auth backend to bypass the broken email pipeline. Side effect: no verification email is sent anymore, and new users get a session immediately. That's why `signup.tsx` routes straight to `/dashboard` and the resend button is unreachable.

## Plan

1. **Turn auto-confirm back off** at the auth backend so Supabase resumes sending the signup confirmation email via its default managed template. Signups will again return without a session until the user clicks the link.
2. **Leave the signup client code as-is.** The existing `needsEmailConfirmation: !data.session` branch will correctly show the "Check your email" screen with the Resend button; the `/dashboard` fall-through stays as a safety net.
3. **Verify end to end** with a fresh Playwright signup: confirm the UI reaches the check-your-email state, confirm the auth backend logs a signup confirmation email send, and confirm the Resend button triggers a second send.

## Not doing

- Not reconnecting `notify.trackhourspro.com` or re-enabling the custom Lovable email pipeline (per your earlier decision).
- Not changing signup UI, copy, or the resend button.
- Not touching password reset or login flows.