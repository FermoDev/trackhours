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

const descriptionSchema = z
  .string()
  .trim()
  .max(500, "Description is too long");

const SIMILARITY_THRESHOLD = 0.6;

type FindOrCreateResult =
  | { success: true; status: "joined" | "created"; id: string; name: string }
  | { success: false; error: string };

const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ");

async function assignClient(userId: string, clientId: string) {
  await supabaseAdmin
    .from("client_assignments")
    .upsert({ user_id: userId, client_id: clientId }, { onConflict: "user_id,client_id", ignoreDuplicates: true });
}

async function assignProject(userId: string, projectId: string, clientId: string) {
  await Promise.all([
    supabaseAdmin
      .from("project_assignments")
      .upsert({ user_id: userId, project_id: projectId }, { onConflict: "user_id,project_id", ignoreDuplicates: true }),
    assignClient(userId, clientId),
  ]);
}

/**
 * Find a client by case-insensitive name, or create it.
 * - Exact or fuzzy match: join the existing client.
 * - No match: create and assign the creator.
 */
export const findOrCreateClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: nameSchema,
        description: descriptionSchema.optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }): Promise<FindOrCreateResult> => {
    const { userId } = context;
    const trimmed = normalizeName(data.name);
    const description = data.description?.trim() || null;

    // Look up existing by case-insensitive name
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("clients")
      .select("id, name, status")
      .ilike("name", trimmed)
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      return { success: false, error: "Lookup failed" };
    }

    if (existing) {
      await assignClient(userId, existing.id);
      return { success: true, status: "joined", id: existing.id, name: existing.name };
    }

    // Fuzzy match: join the closest active client to avoid duplicates.
    const { data: rows } = await supabaseAdmin
      .from("clients")
      .select("id, name")
      .eq("status", "active");
    if (rows && rows.length > 0) {
      const best = rows
        .map((r) => ({ ...r, score: trigramSim(trimmed, r.name) }))
        .sort((a, b) => b.score - a.score)[0];
      if (best && best.score >= SIMILARITY_THRESHOLD) {
        await assignClient(userId, best.id);
        return { success: true, status: "joined", id: best.id, name: best.name };
      }
    }

    // Create new
    const { data: created, error: insertError } = await supabaseAdmin
      .from("clients")
      .insert({ name: trimmed, description, created_by: userId })
      .select("id, name")
      .single();

    if (insertError || !created) {
      const { data: retry } = await supabaseAdmin
        .from("clients")
        .select("id, name")
        .ilike("name", trimmed)
        .limit(1)
        .maybeSingle();
      if (retry) {
        await assignClient(userId, retry.id);
        return { success: true, status: "joined", id: retry.id, name: retry.name };
      }
      return { success: false, error: insertError?.message || "Failed to create client" };
    }

    await assignClient(userId, created.id);
    return { success: true, status: "created", id: created.id, name: created.name };
  });

// Simple trigram similarity in JS as a safety fallback (Dice coefficient on bigrams).
function trigramSim(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
  const grams = (s: string) => {
    const padded = `  ${norm(s)} `;
    const set = new Set<string>();
    for (let i = 0; i < padded.length - 2; i++) set.add(padded.slice(i, i + 3));
    return set;
  };
  const ga = grams(a);
  const gb = grams(b);
  if (ga.size === 0 || gb.size === 0) return 0;
  let inter = 0;
  ga.forEach((g) => { if (gb.has(g)) inter++; });
  return (2 * inter) / (ga.size + gb.size);
}

/**
 * Find a project by case-insensitive name within a client, or create it.
 */
export const findOrCreateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clientId: z.string().uuid(),
        name: nameSchema,
        description: descriptionSchema.optional(),
        force: z.enum(["use", "create"]).optional(),
        forceId: z.string().uuid().optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }): Promise<FindOrCreateResult> => {
    const { supabase, userId } = context;
    const trimmed = data.name.trim();
    const description = data.description?.trim() || null;

    if (data.force === "use" && data.forceId) {
      const { data: existing } = await supabaseAdmin
        .from("projects")
        .select("id, name, client_id")
        .eq("id", data.forceId)
        .maybeSingle();
      if (!existing || existing.client_id !== data.clientId) {
        return { success: false, error: "Project no longer exists" };
      }
      await supabaseAdmin
        .from("project_assignments")
        .insert({ user_id: userId, project_id: existing.id })
        .then(() => undefined, () => undefined);
      await supabaseAdmin
        .from("client_assignments")
        .insert({ user_id: userId, client_id: data.clientId })
        .then(() => undefined, () => undefined);
      return { success: true, status: "joined", id: existing.id, name: existing.name };
    }

    // Verify caller can see this client (RLS will filter)
    const { data: visibleClient } = await supabase
      .from("clients")
      .select("id")
      .eq("id", data.clientId)
      .maybeSingle();

    if (!visibleClient) {
      return { success: false, error: "Client not found or not accessible" };
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
      await supabaseAdmin
        .from("project_assignments")
        .insert({ user_id: userId, project_id: existing.id })
        .then(() => undefined, () => undefined);
      return { success: true, status: "joined", id: existing.id, name: existing.name };
    }

    // Fuzzy within same client
    if (data.force !== "create") {
      const { data: rows } = await supabaseAdmin
        .from("projects")
        .select("id, name")
        .eq("client_id", data.clientId)
        .eq("status", "active");
      if (rows && rows.length > 0) {
        const best = rows
          .map((r) => ({ ...r, score: trigramSim(trimmed, r.name) }))
          .sort((a, b) => b.score - a.score)[0];
        if (best && best.score >= SIMILARITY_THRESHOLD) {
          return {
            success: true,
            status: "needs_confirmation",
            suggestion: { id: best.id, name: best.name },
          };
        }
      }
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from("projects")
      .insert({ name: trimmed, description, client_id: data.clientId, created_by: userId })
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
        return { success: true, status: "joined", id: retry.id, name: retry.name };
      }
      return { success: false, error: insertError?.message || "Failed to create project" };
    }

    await supabaseAdmin
      .from("project_assignments")
      .insert({ user_id: userId, project_id: created.id })
      .then(() => undefined, () => undefined);
    return { success: true, status: "created", id: created.id, name: created.name };
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