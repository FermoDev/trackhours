export type ReminderSettings = {
  daily_enabled: boolean
  daily_time: string // "HH:MM" or "HH:MM:SS"
  month_end_email_enabled: boolean
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  daily_enabled: false,
  daily_time: '17:00',
  month_end_email_enabled: true,
}

export function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  return await Notification.requestPermission()
}

export function showNotification(title: string, body: string, onClick?: () => void) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false
  const n = new Notification(title, { body, tag: 'trackhours-reminder' })
  n.onclick = () => {
    window.focus()
    onClick?.()
    n.close()
  }
  return true
}

/** Minutes since local midnight for a "HH:MM(:SS)" string. */
export function timeToMinutes(time: string): number {
  const [h = '0', m = '0'] = time.split(':')
  return Number(h) * 60 + Number(m)
}

export function minutesSinceMidnight(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes()
}

const FIRED_PREFIX = 'th-daily-reminder-fired:'
const DISMISS_PREFIX = 'th-nudge-dismissed:'

export function hasFiredToday(): boolean {
  try {
    return localStorage.getItem(FIRED_PREFIX + todayKey()) === '1'
  } catch {
    return false
  }
}

export function markFiredToday() {
  try {
    localStorage.setItem(FIRED_PREFIX + todayKey(), '1')
  } catch {
    /* ignore */
  }
}

export function isNudgeDismissedToday(): boolean {
  try {
    return localStorage.getItem(DISMISS_PREFIX + todayKey()) === '1'
  } catch {
    return false
  }
}

export function dismissNudgeToday() {
  try {
    localStorage.setItem(DISMISS_PREFIX + todayKey(), '1')
  } catch {
    /* ignore */
  }
}
