"use server";

import { NextRequest, NextResponse } from "next/server";
import { withAuth, jsonBody } from "@/lib/api-handler";
import {
  listWorkItems,
  createWorkItem,
} from "@/server/services/workItem.service";
import {
  validateQuery,
  PaginationSchema,
  CreateWorkItemSchema,
} from "@/lib/validation";
import { WorkItemStatus, Priority, WorkItemType } from "@prisma/client";

export const GET = withAuth(async (user, req: NextRequest) => {
  const pagination = validateQuery(PaginationSchema, req.nextUrl.searchParams);
  const filters = {
    teamId: req.nextUrl.searchParams.get("teamId") || undefined,
    status: (req.nextUrl.searchParams.get("status") || undefined) as
      | WorkItemStatus
      | undefined,
    priority: (req.nextUrl.searchParams.get("priority") || undefined) as
      | Priority
      | undefined,
    type: (req.nextUrl.searchParams.get("type") || undefined) as
      | WorkItemType
      | undefined,
    assigneeId: req.nextUrl.searchParams.get("assigneeId") || undefined,
    reporterId: req.nextUrl.searchParams.get("reporterId") || undefined,
    search: req.nextUrl.searchParams.get("search") || undefined,
    dueDate: req.nextUrl.searchParams.get("dueDate") || undefined,
    overdue: (req.nextUrl.searchParams.get("overdue") as "true" | "false" | undefined),
  };
  const result = await listWorkItems({
    user,
    filters,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      sort: pagination.sort,
      order: pagination.order,
    },
  });
  return result;
});

export const POST = withAuth(
  async (user, req: NextRequest) => {
    const body = CreateWorkItemSchema.parse(await jsonBody(req));
    const idempotencyKey = req.headers.get("idempotency-key") || undefined;
    const result = await createWorkItem(user, body, idempotencyKey);
    return result;
  },
  { csrf: true },
);
