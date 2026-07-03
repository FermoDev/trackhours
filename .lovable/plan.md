## Goal
Skip email verification for the user "Sabhi Ahmed" so they can sign in without clicking the confirmation link.

## Approach
Run a one-off admin action against the auth system to mark that user's email as confirmed. This does NOT change global auth settings — every other new signup still has to verify their email.

## Steps
1. Look up the user in the auth users table by name/email to confirm the correct account (need to know which email address belongs to Sabhi Ahmed).
2. Set `email_confirmed_at` to now for that single user via the admin API (server-side, service role).
3. Confirm they can now log in with their password.

## Info needed from you
What is Sabhi Ahmed's email address? I want to confirm the right account before flipping the flag.
