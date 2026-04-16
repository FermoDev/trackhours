import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";

type TimeEntry = Tables<"time_entries">;

export type ActiveTimerEntry = TimeEntry & {
  clientName?: string;
  projectName?: string;
};

interface TimerContextValue {
  activeEntry: ActiveTimerEntry | null;
  elapsed: number;
  isLoading: boolean;
  startTimer: (clientId: string, projectId: string, description?: string) => Promise<void>;
  stopTimer: () => Promise<void>;
  refreshTimer: () => Promise<void>;
}

const TimerContext = createContext<TimerContextValue | null>(null);

export function TimerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeEntry, setActiveEntry] = useState<ActiveTimerEntry | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

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
    const calc = () => Math.floor((Date.now() - new Date(activeEntry.start_time!).getTime()) / 1000);
    setElapsed(calc());
    const id = setInterval(() => setElapsed(calc()), 1000);
    return () => clearInterval(id);
  }, [activeEntry]);

  useEffect(() => {
    if (!activeEntry) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [activeEntry]);

  const startTimer = async (clientId: string, projectId: string, description?: string) => {
    if (!user || activeEntry) return;
    setIsLoading(true);
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
    const now = new Date();
    const startTime = new Date(activeEntry.start_time!);
    const durationMinutes = Math.max(1, Math.round((now.getTime() - startTime.getTime()) / 60000));
    await supabase
      .from("time_entries")
      .update({ end_time: now.toISOString(), duration_minutes: durationMinutes })
      .eq("id", activeEntry.id);
    setActiveEntry(null);
    setElapsed(0);
    setIsLoading(false);
  };

  return (
    <TimerContext.Provider value={{ activeEntry, elapsed, isLoading, startTimer, stopTimer, refreshTimer }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used within TimerProvider");
  return ctx;
}
