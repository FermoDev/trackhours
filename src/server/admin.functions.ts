import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
