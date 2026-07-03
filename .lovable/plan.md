Set up domain-based email for the project using Lovable's built-in email infrastructure.

1. **Set up sender domain**
   - Use the in-product email setup dialog to provision a delegated subdomain (e.g. notify.trackhourspro.com).
   - Lovable handles SPF, DKIM, and MX records automatically in the delegated zone.

2. **Provision shared email infrastructure**
   - Run `email_domain--setup_email_infra` to create pgmq queues, the email send log, suppression list, unsubscribe tokens, vault secrets, and the `process-email-queue` cron job.

3. **Scaffold auth email templates**
   - Run `email_domain--scaffold_auth_email_templates` to generate the six standard auth templates (signup, magic-link, recovery, invite, email-change, reauthentication) and the `/lovable/email/auth/webhook` route.
   - Style the templates to match the app's brand: neutral UI, primary accent #00ba6a, Inter font, white email body background.

4. **Verify end-to-end**
   - After DNS and deployment, run a fresh signup test with a real address and confirm the branded verification email is sent.
   - Confirm the “Resend verification email” button on the signup page triggers a second confirmation email.

5. **Optional follow-up**
   - Once auth emails are live, ask whether to scaffold app/transactional emails for contact confirmations, notifications, or other user-triggered messages.

Cost: Lovable Email is included with Lovable Cloud and uses the workspace's existing credit balance; there is no separate email subscription. Usage beyond the free monthly Cloud allowance is deducted from available credits.