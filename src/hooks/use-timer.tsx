import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";
import { ensureNotificationPermission, notifyIdle, shouldRemind } from "@/lib/idle-reminder";

type TimeEntry = Tables<"time_entries">;

export type ActiveTimerEntry = TimeEntry & {
  clientName?: string;
  projectName?: string;
};

interface TimerContextValue {
  activeEntry: ActiveTimerEntry | null;
  elapsed: number;
  isLoading: boolean;
  isPaused: boolean;
  startTimer: (clientId: string, projectId: string, description?: string) => Promise<void>;
  stopTimer: () => Promise<void>;
  pauseTimer: () => void;
  resumeTimer: () => void;
  refreshTimer: () => Promise<void>;
}

const TimerContext = createContext<TimerContextValue | null>(null);

export function TimerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeEntry, setActiveEntry] = useState<ActiveTimerEntry | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pausedElapsed, setPausedElapsed] = useState(0);
  const [pauseOffset, setPauseOffset] = useState(0);
  const lastReminderAtRef = useRef<number | null>(null);

  const refreshTimer = useCallback(async () => {
    if (!user) { setActiveEntry(null); return; }
    const { data } = await supabase
      .from("time_entries")
      .select("*, clients(name), projects(name)")
      .eq("user_id", user.id)
      .eq("entry_mode", "timer")
      .is("end_time", null)
      .order("start_time", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      const d = data as any;
      setActiveEntry({
        ...d,
        clientName: d.clients?.name || undefined,
        projectName: d.projects?.name || undefined,
      });
    } else {
      setActiveEntry(null);
    }
  }, [user]);

  useEffect(() => { refreshTimer(); }, [refreshTimer]);

  useEffect(() => {
    if (!activeEntry?.start_time) { setElapsed(0); return; }
    if (isPaused) return;
    const calc = () => Math.floor((Date.now() - new Date(activeEntry.start_time!).getTime()) / 1000) - pauseOffset;
    setElapsed(calc());
    const id = setInterval(() => setElapsed(calc()), 1000);
    return () => clearInterval(id);
  }, [activeEntry, isPaused, pauseOffset]);

  useEffect(() => {
    if (!activeEntry) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [activeEntry]);

  // Idle reminder: every 60s while running, fire desktop notification at 2h, then every 1h.
  useEffect(() => {
    if (!activeEntry || isPaused) return;
    const tick = () => {
      if (!activeEntry?.start_time) return;
      const elapsedSec = Math.floor((Date.now() - new Date(activeEntry.start_time).getTime()) / 1000) - pauseOffset;
      if (shouldRemind(elapsedSec, lastReminderAtRef.current)) {
        const label = activeEntry.projectName && activeEntry.clientName
          ? `"${activeEntry.projectName} · ${activeEntry.clientName}"`
          : `"${activeEntry.projectName || activeEntry.clientName || "your task"}"`;
        notifyIdle(label, elapsedSec);
        lastReminderAtRef.current = elapsedSec;
      }
    };
    tick(); // run immediately to catch already-long timers (e.g. after refresh)
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [activeEntry, isPaused, pauseOffset]);

  const pauseTimer = () => {
    if (!activeEntry || isPaused) return;
    setIsPaused(true);
    setPausedElapsed(elapsed);
  };

  const resumeTimer = () => {
    if (!activeEntry || !isPaused) return;
    const now = Date.now();
    const startMs = new Date(activeEntry.start_time!).getTime();
    const totalElapsedSinceStart = Math.floor((now - startMs) / 1000);
    const newOffset = totalElapsedSinceStart - pausedElapsed;
    setPauseOffset(newOffset);
    setIsPaused(false);
  };

  const startTimer = async (clientId: string, projectId: string, description?: string) => {
    if (!user || activeEntry) return;
    setIsLoading(true);
    setPauseOffset(0);
    setIsPaused(false);
    setPausedElapsed(0);
    lastReminderAtRef.current = null;
    // Ask for notification permission once, on first start
    void ensureNotificationPermission();
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("time_entries")
      .insert({
        user_id: user.id,
        client_id: clientId,
        project_id: projectId,
        entry_date: now.slice(0, 10),
        start_time: now,
        entry_mode: "timer" as const,
        billable: true,
        status: "draft" as const,
        description: description || null,
      })
      .select("*, clients(name), projects(name)")
      .single();
    if (data) {
      const d = data as any;
      setActiveEntry({
        ...d,
        clientName: d.clients?.name || undefined,
        projectName: d.projects?.name || undefined,
      });
    }
    setIsLoading(false);
  };

  const stopTimer = async () => {
    if (!activeEntry) return;
    setIsLoading(true);
    const finalElapsed = isPaused ? pausedElapsed : elapsed;
    const durationMinutes = Math.max(1, Math.round(finalElapsed / 60));
    await supabase
      .from("time_entries")
      .update({ end_time: new Date().toISOString(), duration_minutes: durationMinutes })
      .eq("id", activeEntry.id);
    setActiveEntry(null);
    setElapsed(0);
    setIsPaused(false);
    setPausedElapsed(0);
    setPauseOffset(0);
    lastReminderAtRef.current = null;
    setIsLoading(false);
  };

  return (
    <TimerContext.Provider value={{ activeEntry, elapsed, isLoading, isPaused, startTimer, stopTimer, pauseTimer, resumeTimer, refreshTimer }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used within TimerProvider");
  return ctx;
}
