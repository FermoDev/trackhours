import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Clock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

export const Route = createFileRoute('/unsubscribe')({
  component: UnsubscribePage,
  head: () => ({
    meta: [
      { title: 'Unsubscribe | TrackHours' },
      {
        name: 'description',
        content: 'Manage your TrackHours email preferences and stop receiving reminder emails.',
      },
      { property: 'og:title', content: 'Unsubscribe | TrackHours' },
      {
        property: 'og:description',
        content: 'Manage your TrackHours email preferences.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
})

type State = 'loading' | 'valid' | 'invalid' | 'used' | 'done' | 'error'

function UnsubscribePage() {
  const [state, setState] = useState<State>('loading')
  const [email, setEmail] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [token, setToken] = useState<string>('')

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token') || ''
    setToken(t)
    if (!t) {
      setState('invalid')
      return
    }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(t)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data.valid === false) {
          setState(data.reason === 'already_unsubscribed' ? 'used' : 'invalid')
          return
        }
        if (data.email) setEmail(data.email)
        setState('valid')
      })
      .catch(() => setState('error'))
  }, [])

  const confirm = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-background">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-7 text-center space-y-4">
          <div className="mx-auto h-10 w-10 rounded-xl bg-primary/15 text-primary grid place-items-center">
            <Clock className="h-5 w-5" />
          </div>

          {state === 'loading' && (
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking your link…
            </p>
          )}

          {state === 'valid' && (
            <>
              <h1 className="text-xl font-semibold tracking-tight">Unsubscribe from emails</h1>
              <p className="text-sm text-muted-foreground">
                {email ? `${email} will ` : 'You will '} no longer receive reminder emails from
                TrackHours. Sign-in and password emails still work.
              </p>
              <Button onClick={confirm} disabled={submitting} className="rounded-xl w-full">
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm unsubscribe
              </Button>
            </>
          )}

          {state === 'done' && (
            <>
              <CheckCircle2 className="h-6 w-6 text-primary mx-auto" />
              <h1 className="text-xl font-semibold tracking-tight">You're unsubscribed</h1>
              <p className="text-sm text-muted-foreground">
                You won't get reminder emails anymore. You can turn them back on in Settings.
              </p>
            </>
          )}

          {state === 'used' && (
            <>
              <h1 className="text-xl font-semibold tracking-tight">Already unsubscribed</h1>
              <p className="text-sm text-muted-foreground">
                This link has already been used — you're not receiving reminder emails.
              </p>
            </>
          )}

          {(state === 'invalid' || state === 'error') && (
            <>
              <AlertCircle className="h-6 w-6 text-destructive mx-auto" />
              <h1 className="text-xl font-semibold tracking-tight">Link not valid</h1>
              <p className="text-sm text-muted-foreground">
                This unsubscribe link is invalid or expired. You can turn reminder emails off in
                your Settings page instead.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
