import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();
  return data?.role === "admin";
}

const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(100, "Name is too long");

/**
 * Find a client by case-insensitive name, or create it.
 * - If found: silently assign the caller to it (so they can see it via RLS).
 * - If not found: create with created_by = caller.
 * Returns minimal data only — never leaks other client info.
 */
export const findOrCreateClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ name: nameSchema }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const trimmed = data.name.trim();

    // Look up existing by case-insensitive name
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("clients")
      .select("id, name, status")
      .ilike("name", trimmed)
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      return { success: false as const, error: "Lookup failed" };
    }

    if (existing) {
      // Silently assign caller so they can see it via RLS
      await supabaseAdmin
        .from("client_assignments")
        .insert({ user_id: userId, client_id: existing.id })
        .select()
        .maybeSingle()
        .then(() => undefined, () => undefined); // ignore conflict

      return {
        success: true as const,
        id: existing.id,
        name: existing.name,
        created: false,
      };
    }

    // Create new
    const { data: created, error: insertError } = await supabaseAdmin
      .from("clients")
      .insert({ name: trimmed, created_by: userId })
      .select("id, name")
      .single();

    if (insertError || !created) {
      // Handle race: maybe another request just created it
      const { data: retry } = await supabaseAdmin
        .from("clients")
        .select("id, name")
        .ilike("name", trimmed)
        .limit(1)
        .maybeSingle();
      if (retry) {
        await supabaseAdmin
          .from("client_assignments")
          .insert({ user_id: userId, client_id: retry.id })
          .then(() => undefined, () => undefined);
        return { success: true as const, id: retry.id, name: retry.name, created: false };
      }
      return { success: false as const, error: insertError?.message || "Failed to create client" };
    }

    return { success: true as const, id: created.id, name: created.name, created: true };
  });

/**
 * Find a project by case-insensitive name within a client, or create it.
 * Caller must be able to see the client (verified via user-scoped RLS).
 */
export const findOrCreateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ clientId: z.string().uuid(), name: nameSchema }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const trimmed = data.name.trim();

    // Verify caller can see this client (RLS will filter)
    const { data: visibleClient } = await supabase
      .from("clients")
      .select("id")
      .eq("id", data.clientId)
      .maybeSingle();

    if (!visibleClient) {
      return { success: false as const, error: "Client not found or not accessible" };
    }

    // Look up existing project (admin client, scoped by clientId)
    const { data: existing } = await supabaseAdmin
      .from("projects")
      .select("id, name")
      .eq("client_id", data.clientId)
      .ilike("name", trimmed)
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Ensure caller is assigned to this project so they can see it
      await supabaseAdmin
        .from("project_assignments")
        .insert({ user_id: userId, project_id: existing.id })
        .then(() => undefined, () => undefined);
      return { success: true as const, id: existing.id, name: existing.name, created: false };
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from("projects")
      .insert({ name: trimmed, client_id: data.clientId, created_by: userId })
      .select("id, name")
      .single();

    if (insertError || !created) {
      const { data: retry } = await supabaseAdmin
        .from("projects")
        .select("id, name")
        .eq("client_id", data.clientId)
        .ilike("name", trimmed)
        .limit(1)
        .maybeSingle();
      if (retry) {
        await supabaseAdmin
          .from("project_assignments")
          .insert({ user_id: userId, project_id: retry.id })
          .then(() => undefined, () => undefined);
        return { success: true as const, id: retry.id, name: retry.name, created: false };
      }
      return { success: false as const, error: insertError?.message || "Failed to create project" };
    }

    return { success: true as const, id: created.id, name: created.name, created: true };
  });

/**
 * Admin-only: merge source client into target. Re-points all related rows.
 */
export const mergeClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sourceId: z.string().uuid(), targetId: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.userId))) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (data.sourceId === data.targetId) {
      return { success: false as const, error: "Source and target must differ" };
    }

    // Re-point time entries
    const { error: teErr } = await supabaseAdmin
      .from("time_entries")
      .update({ client_id: data.targetId })
      .eq("client_id", data.sourceId);
    if (teErr) return { success: false as const, error: teErr.message };

    // Re-point projects
    const { error: pErr } = await supabaseAdmin
      .from("projects")
      .update({ client_id: data.targetId })
      .eq("client_id", data.sourceId);
    if (pErr) return { success: false as const, error: pErr.message };

    // Drop assignments on source (target's stay)
    await supabaseAdmin
      .from("client_assignments")
      .delete()
      .eq("client_id", data.sourceId);

    // Delete source client
    const { error: delErr } = await supabaseAdmin
      .from("clients")
      .delete()
      .eq("id", data.sourceId);
    if (delErr) return { success: false as const, error: delErr.message };

    return { success: true as const, error: null };
  });

/**
 * Admin-only: merge source project into target (must share the same client).
 */
export const mergeProjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sourceId: z.string().uuid(), targetId: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.userId))) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (data.sourceId === data.targetId) {
      return { success: false as const, error: "Source and target must differ" };
    }

    // Verify same client
    const { data: src } = await supabaseAdmin
      .from("projects")
      .select("client_id")
      .eq("id", data.sourceId)
      .single();
    const { data: tgt } = await supabaseAdmin
      .from("projects")
      .select("client_id")
      .eq("id", data.targetId)
      .single();
    if (!src || !tgt) return { success: false as const, error: "Project not found" };
    if (src.client_id !== tgt.client_id) {
      return { success: false as const, error: "Projects must belong to the same client" };
    }

    const { error: teErr } = await supabaseAdmin
      .from("time_entries")
      .update({ project_id: data.targetId })
      .eq("project_id", data.sourceId);
    if (teErr) return { success: false as const, error: teErr.message };

    await supabaseAdmin
      .from("project_assignments")
      .delete()
      .eq("project_id", data.sourceId);

    const { error: delErr } = await supabaseAdmin
      .from("projects")
      .delete()
      .eq("id", data.sourceId);
    if (delErr) return { success: false as const, error: delErr.message };

    return { success: true as const, error: null };
  });