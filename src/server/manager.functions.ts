import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns sanitized profiles (no hourly_rate) for teammates that share a
 * client assignment with the calling manager. Verifies the caller is a
 * manager before returning data.
 */
export const managerListTeammates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (roleRow?.role !== "manager" && roleRow?.role !== "admin") {
      return { profiles: [] as Array<{ user_id: string; full_name: string; email: string }> };
    }

    // Find the manager's client assignments
    const { data: mine } = await supabaseAdmin
      .from("client_assignments")
      .select("client_id")
      .eq("user_id", userId);
    const clientIds = (mine ?? []).map((r) => r.client_id);
    if (clientIds.length === 0) return { profiles: [] };

    // Find all users assigned to those clients
    const { data: theirs } = await supabaseAdmin
      .from("client_assignments")
      .select("user_id")
      .in("client_id", clientIds);
    const userIds = Array.from(new Set((theirs ?? []).map((r) => r.user_id)));
    if (userIds.length === 0) return { profiles: [] };

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", userIds);

    return { profiles: profiles ?? [] };
  });