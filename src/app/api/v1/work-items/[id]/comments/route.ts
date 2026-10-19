"use server";

import { NextRequest } from "next/server";
import { withAuth, jsonBody } from "@/lib/api-handler";
import { AppError, ErrorCode } from "@/lib/http";
import { validateQuery, PaginationSchema } from "@/lib/validation";
import { addComment, listComments } from "@/server/services/workItem.service";
import { z } from "zod";

const CommentSchema = z.object({ body: z.string().min(1).max(5000) });

export const GET = withAuth(async (user, req: NextRequest) => {
  const workItemId = new URL(req.url).searchParams.get("workItemId");
  if (!workItemId) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, "workItemId is required.");
  }
  const pagination = validateQuery(PaginationSchema, req.nextUrl.searchParams);
  return await listComments({
    user,
    workItemId,
    pagination: { page: pagination.page, pageSize: pagination.pageSize },
  });
});

export const POST = withAuth(
  async (user, req: NextRequest) => {
    const workItemId = new URL(req.url).searchParams.get("workItemId");
    if (!workItemId) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "workItemId is required.");
    }
    const body = CommentSchema.parse(await jsonBody(req));
    return await addComment(user, workItemId, { body: body.body });
  },
  { csrf: true },
);
