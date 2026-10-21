import { z, type ZodTypeAny } from "zod";
import {
  WorkItemType,
  WorkItemStatus,
  Priority,
  UserRole,
} from "@prisma/client";
import { AppError, ErrorCode } from "./http";

/**
 * Validation helpers for request bodies and query parameters.
 * All schemas are defined here so they are shared by Route Handlers and
 * Server Actions, keeping validation in one place.
 */

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;

export const WorkItemTypeSchema = z.nativeEnum(WorkItemType);
export const WorkItemStatusSchema = z.nativeEnum(WorkItemStatus);
export const PrioritySchema = z.nativeEnum(Priority);
export const UserRoleSchema = z.nativeEnum(UserRole);

/** Shared work-item creation schema. */
export const CreateWorkItemSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    type: WorkItemTypeSchema,
    priority: PrioritySchema.default("MEDIUM"),
    teamId: z.string().uuid(),
    assigneeId: z.string().uuid().optional().nullable(),
    dueDate: z.string().datetime().optional().nullable(),
  })
  .strict();

export type CreateWorkItemInput = z.infer<typeof CreateWorkItemSchema>;

/**
 * Shared work-item update schema (partial, optimistic-concurrency aware).
 *
 * Status is deliberately absent. Status changes must go through the workflow
 * transition endpoint so the transition graph and transition permission are
 * checked together. `.strict()` rejects a status field instead of silently
 * ignoring it, which makes an attempted bypass an explicit 400.
 */
export const UpdateWorkItemSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    type: WorkItemTypeSchema.optional(),
    priority: PrioritySchema.optional(),
    assigneeId: z.string().uuid().optional().nullable(),
    dueDate: z.string().datetime().optional().nullable(),
    version: z.number().int().nonnegative(),
  })
  .strict();

export type UpdateWorkItemInput = z.infer<typeof UpdateWorkItemSchema>;

/** Validated work-item list filters. */
export const WorkItemFiltersSchema = z
  .object({
    teamId: z.string().uuid().optional(),
    status: WorkItemStatusSchema.optional(),
    priority: PrioritySchema.optional(),
    type: WorkItemTypeSchema.optional(),
    assigneeId: z.string().uuid().optional(),
    reporterId: z.string().uuid().optional(),
    search: z.string().max(200).optional(),
    dueDate: z.string().datetime().optional(),
    overdue: z.enum(["true", "false"]).optional(),
  })
  .strict();

export type WorkItemFiltersInput = z.infer<typeof WorkItemFiltersSchema>;

/** Comment creation. */
export const CreateCommentSchema = z.object({
  body: z.string().min(1).max(5000),
});

export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;

/** Workflow transition. */
export const TransitionWorkItemSchema = z.object({
  status: WorkItemStatusSchema,
  version: z.number().int().nonnegative(),
});

export type TransitionWorkItemInput = z.infer<typeof TransitionWorkItemSchema>;

/** Approval request / decision. */
export const RequestApprovalSchema = z.object({
  workItemId: z.string().uuid(),
});

export type RequestApprovalInput = z.infer<typeof RequestApprovalSchema>;

export const DecideApprovalSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().max(1000).optional(),
});

export type DecideApprovalInput = z.infer<typeof DecideApprovalSchema>;

/** Team creation / update. */
export const TeamSchema = z
  .object({
    key: z.string().min(1).max(20).toUpperCase(),
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
  })
  .strict();

export type TeamInput = z.infer<typeof TeamSchema>;

/**
 * A team membership can only carry a team-scoped role. ADMIN and MANAGER are
 * global identities and are not assignable through the team API.
 */
export const TeamMembershipRoleSchema = z.enum([
  "TEAM_LEAD",
  "TEAM_MEMBER",
  "MEMBER",
]);

export type TeamMembershipRoleInput = z.infer<typeof TeamMembershipRoleSchema>;

export const AddTeamMemberSchema = z
  .object({
    userId: z.string().uuid(),
    role: TeamMembershipRoleSchema,
  })
  .strict();

export type AddTeamMemberInput = z.infer<typeof AddTeamMemberSchema>;

/**
 * Validate an object against a Zod schema, returning a typed result or
 * throwing an AppError with VALIDATION_ERROR and field details.
 */
export function validateInput<T extends ZodTypeAny>(
  schema: T,
  input: unknown,
): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const details: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".") || "body";
      details[path] = [...(details[path] ?? []), issue.message];
    }
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, "Invalid request.", details);
  }
  return result.data as z.infer<T>;
}

/** Validate query parameters from a URLSearchParams object. */
export function validateQuery<T extends ZodTypeAny>(
  schema: T,
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
): z.infer<T> {
  const raw: Record<string, unknown> = {};
  if (searchParams instanceof URLSearchParams) {
    for (const [key, value] of searchParams.entries()) {
      raw[key] = value;
    }
  } else {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined) raw[key] = Array.isArray(value) ? value[0] : value;
    }
  }
  return validateInput(schema, raw);
}
