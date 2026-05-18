import { supabaseAdmin } from "@/integrations/supabase/client.server";

type UserScopedSupabase = {
  from: typeof supabaseAdmin.from;
};

export type FindOrCreateResult =
  | { success: true; status: "joined" | "created"; id: string; name: string }
  | { success: false; error: string };

const SIMILARITY_THRESHOLD = 0.6;

const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ");
const sameName = (a: string, b: string) => normalizeName(a).toLowerCase() === normalizeName(b).toLowerCase();

export async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();
  return data?.role === "admin";
}

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

function bestSimilar<T extends { name: string }>(typed: string, rows: T[]): (T & { score: number }) | null {
  if (rows.length === 0) return null;
  const best = rows
    .map((row) => ({ ...row, score: trigramSim(typed, row.name) }))
    .sort((a, b) => b.score - a.score)[0];
  return best && best.score >= SIMILARITY_THRESHOLD ? best : null;
}

export async function findOrCreateClientForUser(input: {
  userId: string;
  name: string;
  description?: string;
  code?: string;
}): Promise<FindOrCreateResult> {
  const trimmed = normalizeName(input.name);
  const description = input.description?.trim() || null;
  const code = input.code?.trim() || null;

  const { data: rows, error: lookupError } = await supabaseAdmin
    .from("clients")
    .select("id, name")
    .eq("status", "active");

  if (lookupError) return { success: false, error: "Client lookup failed" };

  const exact = rows?.find((row) => sameName(row.name, trimmed));
  if (exact) {
    await assignClient(input.userId, exact.id);
    return { success: true, status: "joined", id: exact.id, name: exact.name };
  }

  const similar = bestSimilar(trimmed, rows ?? []);
  if (similar) {
    await assignClient(input.userId, similar.id);
    return { success: true, status: "joined", id: similar.id, name: similar.name };
  }

  const { data: created, error: insertError } = await supabaseAdmin
    .from("clients")
    .insert({ name: trimmed, description, code, created_by: input.userId })
    .select("id, name")
    .single();

  if (insertError || !created) {
    const { data: retryRows } = await supabaseAdmin
      .from("clients")
      .select("id, name")
      .eq("status", "active");
    const retry = retryRows?.find((row) => sameName(row.name, trimmed));
    if (retry) {
      await assignClient(input.userId, retry.id);
      return { success: true, status: "joined", id: retry.id, name: retry.name };
    }
    return { success: false, error: insertError?.message || "Failed to create client" };
  }

  await assignClient(input.userId, created.id);
  return { success: true, status: "created", id: created.id, name: created.name };
}

export async function findOrCreateProjectForUser(input: {
  userId: string;
  supabase: UserScopedSupabase;
  clientId: string;
  name: string;
  description?: string;
  billableDefault?: boolean;
}): Promise<FindOrCreateResult> {
  const trimmed = normalizeName(input.name);
  const description = input.description?.trim() || null;

  const { data: visibleClient } = await input.supabase
    .from("clients")
    .select("id")
    .eq("id", input.clientId)
    .maybeSingle();

  if (!visibleClient) return { success: false, error: "Client not found or not accessible" };

  const { data: rows, error: lookupError } = await supabaseAdmin
    .from("projects")
    .select("id, name, client_id")
    .eq("client_id", input.clientId)
    .eq("status", "active");

  if (lookupError) return { success: false, error: "Project lookup failed" };

  const exact = rows?.find((row) => sameName(row.name, trimmed));
  if (exact) {
    await assignProject(input.userId, exact.id, input.clientId);
    return { success: true, status: "joined", id: exact.id, name: exact.name };
  }

  const similar = bestSimilar(trimmed, rows ?? []);
  if (similar) {
    await assignProject(input.userId, similar.id, input.clientId);
    return { success: true, status: "joined", id: similar.id, name: similar.name };
  }

  const { data: created, error: insertError } = await supabaseAdmin
    .from("projects")
    .insert({
      name: trimmed,
      description,
      client_id: input.clientId,
      created_by: input.userId,
      billable_default: input.billableDefault ?? true,
    })
    .select("id, name")
    .single();

  if (insertError || !created) {
    const { data: retryRows } = await supabaseAdmin
      .from("projects")
      .select("id, name, client_id")
      .eq("client_id", input.clientId)
      .eq("status", "active");
    const retry = retryRows?.find((row) => sameName(row.name, trimmed));
    if (retry) {
      await assignProject(input.userId, retry.id, input.clientId);
      return { success: true, status: "joined", id: retry.id, name: retry.name };
    }
    return { success: false, error: insertError?.message || "Failed to create project" };
  }

  await assignProject(input.userId, created.id, input.clientId);
  return { success: true, status: "created", id: created.id, name: created.name };
}

export async function mergeClientsForAdmin(sourceId: string, targetId: string) {
  if (sourceId === targetId) return { success: false as const, error: "Source and target must differ" };

  const { data: sourceAssignments } = await supabaseAdmin
    .from("client_assignments")
    .select("user_id")
    .eq("client_id", sourceId);

  if (sourceAssignments?.length) {
    await supabaseAdmin
      .from("client_assignments")
      .upsert(
        sourceAssignments.map((row) => ({ user_id: row.user_id, client_id: targetId })),
        { onConflict: "user_id,client_id", ignoreDuplicates: true },
      );
  }

  const { error: teErr } = await supabaseAdmin
    .from("time_entries")
    .update({ client_id: targetId })
    .eq("client_id", sourceId);
  if (teErr) return { success: false as const, error: teErr.message };

  const { error: pErr } = await supabaseAdmin
    .from("projects")
    .update({ client_id: targetId })
    .eq("client_id", sourceId);
  if (pErr) return { success: false as const, error: pErr.message };

  await supabaseAdmin.from("client_assignments").delete().eq("client_id", sourceId);

  const { error: delErr } = await supabaseAdmin.from("clients").delete().eq("id", sourceId);
  if (delErr) return { success: false as const, error: delErr.message };

  return { success: true as const, error: null };
}

export async function mergeProjectsForAdmin(sourceId: string, targetId: string) {
  if (sourceId === targetId) return { success: false as const, error: "Source and target must differ" };

  const { data: src } = await supabaseAdmin.from("projects").select("client_id").eq("id", sourceId).single();
  const { data: tgt } = await supabaseAdmin.from("projects").select("client_id").eq("id", targetId).single();
  if (!src || !tgt) return { success: false as const, error: "Project not found" };
  if (src.client_id !== tgt.client_id) return { success: false as const, error: "Projects must belong to the same client" };

  const { data: sourceAssignments } = await supabaseAdmin
    .from("project_assignments")
    .select("user_id")
    .eq("project_id", sourceId);

  if (sourceAssignments?.length) {
    await supabaseAdmin
      .from("project_assignments")
      .upsert(
        sourceAssignments.map((row) => ({ user_id: row.user_id, project_id: targetId })),
        { onConflict: "user_id,project_id", ignoreDuplicates: true },
      );
  }

  const { error: teErr } = await supabaseAdmin
    .from("time_entries")
    .update({ project_id: targetId })
    .eq("project_id", sourceId);
  if (teErr) return { success: false as const, error: teErr.message };

  await supabaseAdmin.from("project_assignments").delete().eq("project_id", sourceId);

  const { error: delErr } = await supabaseAdmin.from("projects").delete().eq("id", sourceId);
  if (delErr) return { success: false as const, error: delErr.message };

  return { success: true as const, error: null };
}

function trigramSim(a: string, b: string): number {
  const grams = (s: string) => {
    const padded = `  ${normalizeName(s).toLowerCase()} `;
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
