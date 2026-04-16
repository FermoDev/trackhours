import { useTimer } from "@/hooks/use-timer";
import { formatTimerDisplay } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Square, Clock } from "lucide-react";

export function StickyTimer() {
  const { activeEntry, elapsed, stopTimer, isLoading } = useTimer();

  if (!activeEntry) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-timer text-timer-foreground shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Clock className="h-4 w-4 shrink-0 animate-pulse" />
          <div className="min-w-0 flex items-center gap-3">
            <span className="font-mono text-lg font-bold tracking-wider tabular-nums">
              {formatTimerDisplay(elapsed)}
            </span>
            <span className="hidden sm:inline text-sm opacity-80 truncate">
              {activeEntry.projectName && activeEntry.clientName
                ? `${activeEntry.projectName} · ${activeEntry.clientName}`
                : activeEntry.projectName || activeEntry.clientName || ""}
            </span>
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={stopTimer}
          disabled={isLoading}
          className="rounded-xl shrink-0"
        >
          <Square className="h-3 w-3 mr-1" /> Stop
        </Button>
      </div>
    </div>
  );
}
