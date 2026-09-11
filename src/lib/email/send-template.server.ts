import * as React from 'react'
import { render } from '@react-email/render'
import type { SupabaseClient } from '@supabase/supabase-js'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'Time Keeper Pro'
const SENDER_DOMAIN = 'notify.trackhourspro.com'
const FROM_DOMAIN = 'trackhourspro.com'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function redactEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return '***'
  return `${local[0]}***@${domain}`
}

type SendResult =
  | { sent: true }
  | { sent: false; reason: 'suppressed' | 'unknown_template' | 'failed'; error?: string }

/**
 * Server-side (service-role) send of a registered template.
 * Mirrors the scaffolded /lovable/email/transactional/send route, but is callable
 * from trusted server code (e.g. scheduled jobs) without a user bearer token.
 */
export async function sendTemplateEmail(
  supabase: SupabaseClient<any>,
  opts: {
    templateName: string
    recipientEmail: string
    idempotencyKey: string
    templateData?: Record<string, any>
  },
): Promise<SendResult> {
  const template = TEMPLATES[opts.templateName]
  if (!template) return { sent: false, reason: 'unknown_template' }

  const recipient = template.to || opts.recipientEmail
  if (!recipient) return { sent: false, reason: 'failed', error: 'No recipient' }

  const messageId = crypto.randomUUID()
  const normalized = recipient.toLowerCase()

  const { data: suppressed, error: suppressionError } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', normalized)
    .maybeSingle()

  if (suppressionError) {
    return { sent: false, reason: 'failed', error: 'Suppression check failed' }
  }
  if (suppressed) {
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: opts.templateName,
      recipient_email: recipient,
      status: 'suppressed',
    })
    return { sent: false, reason: 'suppressed' }
  }

  // Get or create the recipient's unsubscribe token
  let unsubscribeToken: string
  const { data: existingToken } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalized)
    .maybeSingle()

  if (existingToken && !existingToken.used_at) {
    unsubscribeToken = existingToken.token
  } else if (!existingToken) {
    unsubscribeToken = generateToken()
    await supabase
      .from('email_unsubscribe_tokens')
      .upsert(
        { token: unsubscribeToken, email: normalized },
        { onConflict: 'email', ignoreDuplicates: true },
      )
    const { data: stored } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalized)
      .maybeSingle()
    if (!stored) return { sent: false, reason: 'failed', error: 'Token storage failed' }
    unsubscribeToken = stored.token
  } else {
    // Token was used previously, but the address is not suppressed (re-subscribed):
    // issue a fresh token instead of silently dropping the email.
    unsubscribeToken = generateToken()
    const { error: tokenError } = await supabase
      .from('email_unsubscribe_tokens')
      .update({ token: unsubscribeToken, used_at: null })
      .eq('email', normalized)
    if (tokenError) return { sent: false, reason: 'failed', error: 'Token refresh failed' }
  }

  const element = React.createElement(template.component, opts.templateData ?? {})
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const subject =
    typeof template.subject === 'function'
      ? template.subject(opts.templateData ?? {})
      : template.subject

  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: opts.templateName,
    recipient_email: recipient,
    status: 'pending',
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: recipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: 'transactional',
      label: opts.templateName,
      idempotency_key: opts.idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue email', {
      recipient_redacted: redactEmail(recipient),
      message: enqueueError.message,
    })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: opts.templateName,
      recipient_email: recipient,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })
    return { sent: false, reason: 'failed', error: enqueueError.message }
  }

  return { sent: true }
}
