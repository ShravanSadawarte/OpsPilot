"use server";

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { AppError, ErrorCode } from "@/lib/http";
import { validateQuery, PaginationSchema } from "@/lib/validation";
import { listActivity } from "@/server/services/workItem.service";

export const GET = withAuth(async (user, req: NextRequest) => {
  const workItemId = new URL(req.url).searchParams.get("workItemId");
  if (!workItemId) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, "workItemId is required.");
  }
  const pagination = validateQuery(PaginationSchema, req.nextUrl.searchParams);
  return await listActivity({
    user,
    workItemId,
    pagination: { page: pagination.page, pageSize: pagination.pageSize },
  });
});
