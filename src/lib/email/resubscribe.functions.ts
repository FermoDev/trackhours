import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Clears an email suppression created by a one-click unsubscribe, so a user who
 * re-enables reminder emails in Settings actually starts receiving them again.
 */
export const resubscribeEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("user_id", context.userId)
      .maybeSingle();

    const email = (profile?.email || "").toLowerCase();
    if (!email) return { resubscribed: false as const };

    await supabaseAdmin.from("suppressed_emails").delete().eq("email", email);
    await supabaseAdmin.from("email_unsubscribe_tokens").delete().eq("email", email);

    return { resubscribed: true as const };
  });
