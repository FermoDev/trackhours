import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AppRole = "admin" | "freelancer" | "manager";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();
  return data?.role === "admin";
}

async function countAdmins(): Promise<number> {
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
    if (!(await assertAdmin(context.userId))) {
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
      const adminCount = await countAdmins();
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
    if (!(await assertAdmin(context.userId))) {
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
    if (!(await assertAdmin(context.userId))) {
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
      const adminCount = await countAdmins();
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
