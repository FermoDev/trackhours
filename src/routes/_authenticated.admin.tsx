import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { role, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && role !== "admin") {
      navigate({ to: "/dashboard" });
    }
  }, [isLoading, role, navigate]);

  if (isLoading || role !== "admin") return null;
  return <Outlet />;
}
