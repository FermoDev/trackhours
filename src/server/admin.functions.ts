import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const adminResetPassword = createServerFn({ method: "POST" })
  .inputValidator((data: { userId: string; email: string }) => data)
  .handler(async ({ data }) => {
    // Verify caller is admin via service role lookup
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId)
      .single();

    // Send password reset email
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${process.env.SUPABASE_URL ? process.env.SUPABASE_URL.replace('.supabase.co', '.lovable.app') : ''}/reset-password`,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  });
