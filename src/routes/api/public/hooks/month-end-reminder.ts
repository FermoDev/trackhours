import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import { sendTemplateEmail } from '@/lib/email/send-template.server'

const APP_URL = 'https://trackhourspro.com/dashboard'
const REMINDER_WINDOW_DAYS = 5

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function formatMinutes(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export const Route = createFileRoute('/api/public/hooks/month-end-reminder')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
        const supabaseUrl = process.env['SUPABASE_URL'] || import.meta.env['VITE_SUPABASE_URL']

        if (!serviceKey || !supabaseUrl) {
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        // Only the scheduler (which holds the service role key) may trigger this.
        const auth = request.headers.get('authorization') || ''
        const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
        if (token !== serviceKey) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const now = new Date()
        const year = now.getUTCFullYear()
        const month = now.getUTCMonth()
        const today = now.getUTCDate()
        const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
        const daysLeft = lastDay - today + 1

        if (daysLeft > REMINDER_WINDOW_DAYS) {
          return Response.json({ skipped: true, reason: 'outside_window', daysLeft })
        }

        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })

        const monthStart = `${year}-${pad(month + 1)}-01`
        const monthEnd = `${year}-${pad(month + 1)}-${pad(lastDay)}`
        const monthName = new Date(Date.UTC(year, month, 1)).toLocaleString('en-US', {
          month: 'long',
          timeZone: 'UTC',
        })
        const todayIso = `${year}-${pad(month + 1)}-${pad(today)}`

        const [profilesRes, settingsRes, entriesRes, logRes] = await Promise.all([
          supabase.from('profiles').select('user_id, full_name, email').eq('status', 'active'),
          supabase
            .from('reminder_settings')
            .select('user_id, month_end_email_enabled'),
          supabase
            .from('time_entries')
            .select('user_id, entry_date, duration_minutes')
            .gte('entry_date', monthStart)
            .lte('entry_date', monthEnd)
            .not('duration_minutes', 'is', null),
          supabase
            .from('reminder_email_log')
            .select('user_id')
            .eq('sent_for_date', todayIso)
            .eq('kind', 'month_end'),
        ])

        if (profilesRes.error) {
          return Response.json({ error: profilesRes.error.message }, { status: 500 })
        }

        const disabled = new Set(
          (settingsRes.data ?? [])
            .filter((s: any) => s.month_end_email_enabled === false)
            .map((s: any) => s.user_id),
        )
        const alreadySent = new Set((logRes.data ?? []).map((r: any) => r.user_id))

        // Aggregate per-user minutes and the set of dates they logged
        const totals = new Map<string, number>()
        const logged = new Map<string, Set<string>>()
        for (const e of entriesRes.data ?? []) {
          totals.set(e.user_id, (totals.get(e.user_id) ?? 0) + (e.duration_minutes ?? 0))
          const set = logged.get(e.user_id) ?? new Set<string>()
          set.add(e.entry_date)
          logged.set(e.user_id, set)
        }

        // Weekdays in the month up to today
        const weekdays: string[] = []
        for (let d = 1; d <= today; d++) {
          const date = new Date(Date.UTC(year, month, d))
          const dow = date.getUTCDay()
          if (dow === 0 || dow === 6) continue
          weekdays.push(`${year}-${pad(month + 1)}-${pad(d)}`)
        }

        let sent = 0
        let skipped = 0

        for (const profile of profilesRes.data ?? []) {
          const userId = profile.user_id as string
          const email = (profile.email as string) || ''
          if (!email || disabled.has(userId) || alreadySent.has(userId)) {
            skipped++
            continue
          }

          const loggedDates = logged.get(userId) ?? new Set<string>()
          const missing = weekdays.filter((d) => !loggedDates.has(d))
          if (missing.length === 0) {
            skipped++
            continue
          }

          // Claim the send first so a duplicate run can't double-send
          const { error: claimError } = await supabase
            .from('reminder_email_log')
            .insert({ user_id: userId, sent_for_date: todayIso, kind: 'month_end' })
          if (claimError) {
            skipped++
            continue
          }

          const missingLabels = missing.slice(-10).map((d) => {
            const day = Number(d.slice(8, 10))
            return `${monthName.slice(0, 3)} ${day}`
          })

          const result = await sendTemplateEmail(supabase, {
            templateName: 'month-end-reminder',
            recipientEmail: email,
            idempotencyKey: `month-end-${userId}-${todayIso}`,
            templateData: {
              name: (profile.full_name as string) || undefined,
              monthName,
              hoursLogged: formatMinutes(totals.get(userId) ?? 0),
              daysLeft,
              missingDays: missingLabels,
              appUrl: APP_URL,
            },
          })

          if (result.sent) sent++
          else skipped++
        }

        return Response.json({ success: true, daysLeft, sent, skipped })
      },
    },
  },
})
