import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/manager")({
  component: ManagerLayout,
});

function ManagerLayout() {
  const { role, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && role !== "manager" && role !== "admin") {
      navigate({ to: "/dashboard" });
    }
  }, [isLoading, role, navigate]);

  if (isLoading || (role !== "manager" && role !== "admin")) return null;
  return <Outlet />;
}