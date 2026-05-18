import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  findOrCreateClientForUser,
  findOrCreateProjectForUser,
  isAdmin,
  mergeClientsForAdmin,
  mergeProjectsForAdmin,
  type FindOrCreateResult,
} from "./clients.server";

const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(100, "Name is too long");

const descriptionSchema = z
  .string()
  .trim()
  .max(500, "Description is too long");

export const findOrCreateClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: nameSchema,
        description: descriptionSchema.optional(),
        code: z.string().trim().max(40, "Code is too long").optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }): Promise<FindOrCreateResult> => {
    return findOrCreateClientForUser({
      userId: context.userId,
      name: data.name,
      description: data.description,
      code: data.code,
    });
  });

export const findOrCreateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clientId: z.string().uuid(),
        name: nameSchema,
        description: descriptionSchema.optional(),
        billableDefault: z.boolean().optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }): Promise<FindOrCreateResult> => {
    return findOrCreateProjectForUser({
      userId: context.userId,
      supabase: context.supabase,
      clientId: data.clientId,
      name: data.name,
      description: data.description,
      billableDefault: data.billableDefault,
    });
  });

export const mergeClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sourceId: z.string().uuid(), targetId: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.userId))) return { success: false as const, error: "Unauthorized" };
    return mergeClientsForAdmin(data.sourceId, data.targetId);
  });

export const mergeProjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sourceId: z.string().uuid(), targetId: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.userId))) return { success: false as const, error: "Unauthorized" };
    return mergeProjectsForAdmin(data.sourceId, data.targetId);
  });
