import { useTimer } from "@/hooks/use-timer";
import { formatTimerDisplay } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Square, Clock, Pause, Play, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FIRST_REMINDER_AFTER } from "@/lib/idle-reminder";

export function StickyTimer() {
  const { activeEntry, elapsed, stopTimer, isPaused, pauseTimer, resumeTimer, isLoading } = useTimer();

  if (!activeEntry) return null;

  const isLongRunning = elapsed >= FIRST_REMINDER_AFTER && !isPaused;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 shadow-md transition-colors",
        isLongRunning ? "bg-warning text-warning-foreground" : "bg-timer text-timer-foreground",
      )}
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Clock className="h-4 w-4 shrink-0 animate-pulse" />
          {isPaused && <span className="text-xs font-medium opacity-80 bg-background/20 px-1.5 py-0.5 rounded">Paused</span>}
          {isLongRunning && <span className="text-xs font-semibold bg-background/20 px-1.5 py-0.5 rounded">Still working?</span>}
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
          onClick={isPaused ? resumeTimer : pauseTimer}
          disabled={isLoading}
          className="rounded-xl shrink-0"
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : isPaused ? (
            <Play className="h-3 w-3 mr-1" />
          ) : (
            <Pause className="h-3 w-3 mr-1" />
          )}
          {isPaused ? "Resume" : "Pause"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={stopTimer}
          disabled={isLoading}
          className="rounded-xl shrink-0"
        >
          {isLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Square className="h-3 w-3 mr-1" />}
          Stop
        </Button>
      </div>
    </div>
  );
}
