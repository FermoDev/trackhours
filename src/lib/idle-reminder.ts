export const FIRST_REMINDER_AFTER = 2 * 3600; // 2h
export const REPEAT_REMINDER_EVERY = 1 * 3600; // 1h

export function shouldRemind(elapsedSec: number, lastRemindedAt: number | null): boolean {
  if (elapsedSec < FIRST_REMINDER_AFTER) return false;
  if (lastRemindedAt === null) return true;
  return elapsedSec - lastRemindedAt >= REPEAT_REMINDER_EVERY;
}

export function notifyIdle(label: string, elapsedSec: number) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const h = Math.floor(elapsedSec / 3600);
  const m = Math.floor((elapsedSec % 3600) / 60);
  const elapsedLabel = `${h}h ${m}m`;
  try {
    const n = new Notification("⏱ Still tracking time?", {
      body: `Your timer for ${label} has been running for ${elapsedLabel}. Click to stop it if you're done.`,
      tag: "timer-idle-reminder",
      requireInteraction: true,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // ignore
  }
}

export async function ensureNotificationPermission(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      // ignore
    }
  }
}