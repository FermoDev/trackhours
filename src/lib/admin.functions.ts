import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AppRole = "admin" | "freelancer";

type AdminClient = Awaited<ReturnType<typeof loadAdmin>>;
async function loadAdmin() {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

async function assertAdmin(supabaseAdmin: AdminClient, userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();
  return data?.role === "admin";
}

async function countAdmins(supabaseAdmin: AdminClient): Promise<number> {
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");
  return count ?? 0;
}

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string }) => data)
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await loadAdmin();
    // Verify caller is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .single();

    if (roleData?.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }

    const siteUrl = process.env.SUPABASE_URL
      ? `https://${process.env.SUPABASE_URL.split("//")[1]?.replace(".supabase.co", "")}.lovable.app`
      : "";

    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${siteUrl}/reset-password`,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  });

export const adminUpdateUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; role: AppRole }) => data)
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await loadAdmin();
    if (!(await assertAdmin(supabaseAdmin, context.userId))) {
      return { success: false, error: "Unauthorized" };
    }
    if (data.userId === context.userId && data.role !== "admin") {
      return { success: false, error: "You cannot change your own admin role" };
    }

    // Check current role
    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId)
      .single();

    if (existing?.role === "admin" && data.role !== "admin") {
      const adminCount = await countAdmins(supabaseAdmin);
      if (adminCount <= 1) {
        return { success: false, error: "At least one admin must remain" };
      }
    }

    if (existing) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .update({ role: data.role })
        .eq("user_id", data.userId);
      if (error) return { success: false, error: error.message };
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role });
      if (error) return { success: false, error: error.message };
    }
    return { success: true, error: null };
  });

export const adminSetUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; status: "active" | "inactive" }) => data)
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await loadAdmin();
    if (!(await assertAdmin(supabaseAdmin, context.userId))) {
      return { success: false, error: "Unauthorized" };
    }
    if (data.userId === context.userId) {
      return { success: false, error: "You cannot change your own status" };
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ status: data.status })
      .eq("user_id", data.userId);
    if (profileError) return { success: false, error: profileError.message };

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.status === "inactive" ? "876000h" : "none",
    });
    if (authError) return { success: false, error: authError.message };

    return { success: true, error: null };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await loadAdmin();
    if (!(await assertAdmin(supabaseAdmin, context.userId))) {
      return { success: false, error: "Unauthorized" };
    }
    if (data.userId === context.userId) {
      return { success: false, error: "You cannot delete your own account" };
    }

    const { data: targetRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId)
      .single();
    if (targetRole?.role === "admin") {
      const adminCount = await countAdmins(supabaseAdmin);
      if (adminCount <= 1) {
        return { success: false, error: "At least one admin must remain" };
      }
    }

    // Clean up app data first (FKs may not cascade from auth.users)
    await supabaseAdmin.from("time_entries").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("project_assignments").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("activity_logs").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("user_id", data.userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) return { success: false, error: error.message };

    return { success: true, error: null };
  });

export const getUserStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await loadAdmin();
    if (!(await assertAdmin(supabaseAdmin, context.userId))) {
      return { success: false as const, error: "Unauthorized" };
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().slice(0, 10);
    const ninetyAgo = new Date();
    ninetyAgo.setDate(ninetyAgo.getDate() - 90);
    const ninetyAgoStr = ninetyAgo.toISOString().slice(0, 10);

    // All entries with completed durations
    const { data: allEntries } = await supabaseAdmin
      .from("time_entries")
      .select("entry_date, duration_minutes, billable, client_id, project_id")
      .eq("user_id", data.userId)
      .not("duration_minutes", "is", null);

    const entries = allEntries || [];

    let today = 0, week = 0, month = 0, allTime = 0, billableMins = 0;
    const clientTotals = new Map<string, number>();
    const projectTotals = new Map<string, number>();
    for (const e of entries) {
      const m = e.duration_minutes || 0;
      allTime += m;
      if (e.billable) billableMins += m;
      if (e.entry_date === todayStr) today += m;
      if (e.entry_date >= weekStartStr) week += m;
      if (e.entry_date >= monthStartStr) month += m;
      if (e.entry_date >= ninetyAgoStr) {
        if (e.client_id) clientTotals.set(e.client_id, (clientTotals.get(e.client_id) || 0) + m);
        if (e.project_id) projectTotals.set(e.project_id, (projectTotals.get(e.project_id) || 0) + m);
      }
    }

    const topClientIds = [...clientTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topProjectIds = [...projectTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    const clientIds = topClientIds.map(([id]) => id);
    const projectIds = topProjectIds.map(([id]) => id);

    const [clientsRes, projectsRes] = await Promise.all([
      clientIds.length
        ? supabaseAdmin.from("clients").select("id, name").in("id", clientIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      projectIds.length
        ? supabaseAdmin.from("projects").select("id, name, client_id, clients(name)").in("id", projectIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const clientNameMap = new Map((clientsRes.data || []).map((c: any) => [c.id, c.name as string]));
    const projectInfoMap = new Map(
      (projectsRes.data || []).map((p: any) => [p.id, { name: p.name as string, clientName: p.clients?.name as string | undefined }]),
    );

    const topClients = topClientIds.map(([id, mins]) => ({
      id,
      name: clientNameMap.get(id) || "Unknown",
      minutes: mins,
    }));
    const topProjects = topProjectIds.map(([id, mins]) => ({
      id,
      name: projectInfoMap.get(id)?.name || "Unknown",
      clientName: projectInfoMap.get(id)?.clientName || "",
      minutes: mins,
    }));

    // Recent 10 entries with names
    const { data: recent } = await supabaseAdmin
      .from("time_entries")
      .select("id, entry_date, duration_minutes, description, clients(name), projects(name)")
      .eq("user_id", data.userId)
      .not("duration_minutes", "is", null)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10);

    const recentEntries = (recent || []).map((e: any) => ({
      id: e.id,
      entry_date: e.entry_date,
      duration_minutes: e.duration_minutes || 0,
      description: e.description,
      clientName: e.clients?.name || "—",
      projectName: e.projects?.name || "—",
    }));

    return {
      success: true as const,
      error: null,
      stats: {
        totals: { today, week, month, allTime, billableMinutes: billableMins },
        topClients,
        topProjects,
        recentEntries,
      },
    };
  });
