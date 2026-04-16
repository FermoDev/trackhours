import { useTimer } from "@/hooks/use-timer";
import { formatTimerDisplay } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Square, Clock } from "lucide-react";

export function StickyTimer() {
  const { activeEntry, elapsed, stopTimer, isLoading } = useTimer();

  if (!activeEntry) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-timer text-timer-foreground rounded-2xl shadow-lg px-5 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-4">
      <Clock className="h-4 w-4 animate-pulse" />
      <div className="text-sm">
        <p className="font-mono text-lg font-bold tracking-wider">{formatTimerDisplay(elapsed)}</p>
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={stopTimer}
        disabled={isLoading}
        className="rounded-xl"
      >
        <Square className="h-3 w-3 mr-1" /> Stop
      </Button>
    </div>
  );
}
