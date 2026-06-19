import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useTimer } from "@/hooks/use-timer";
import { AppSidebar } from "@/components/AppSidebar";
import { QuickTimerFab } from "@/components/QuickTimerFab";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const { activeEntry } = useTimer();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className={`flex-1 overflow-auto transition-[padding] duration-200 ${activeEntry ? "pt-12" : ""}`}>
        <div className="w-full px-4 md:px-8 py-6 md:py-8">
          <Outlet />
        </div>
      </main>
      <QuickTimerFab />
    </div>
  );
}
