## Revert to the previous email workflow

You want to go back to Lovable's default managed auth emails (no custom sender domain, no queue infrastructure to maintain). Doing that also fixes the build error, since the file causing it is part of the domain-based setup we no longer need.

### Steps

1. **Disable Lovable Emails for this project** — flips auth emails back to Lovable's default templates delivered via Lovable's shared sender. This is exactly the workflow you had before today.
2. **Delete `src/routes/lovable/email/queue/process.ts`** — the file whose missing `@lovable.dev/email-js` import is failing the build. It only exists to process the custom queue we no longer need.
3. **Leave everything else alone** — no code changes to auth flow, signup page, Supabase client, or middleware. The DB tables the setup created (`email_send_log`, pgmq queues, etc.) are harmless when unused; removing them requires a destructive migration and offers no benefit.

### About the original delivery problem

Reverting restores the exact behavior you had before — including the shared-sender deliverability risk that started this thread. New signups will again rely on Lovable's default sender. If specific users report they still don't get the verification email, the interim fix is for you (as admin) to manually confirm their email in the DB so they can log in; I can wire up a small admin action for that if/when it comes up.

### DNS note

The NS records you added at your DNS provider for `notify.trackhourspro.com` can stay or be removed at your convenience — they don't affect the app either way once Lovable Emails is disabled. If you want, remove them at your registrar.
