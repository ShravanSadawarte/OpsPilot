"use server";

import { NextRequest } from "next/server";
import { withAuth, jsonBody } from "@/lib/api-handler";
import { AppError, ErrorCode } from "@/lib/http";
import { assignWorkItem } from "@/server/services/workItem.service";
import { z } from "zod";

const AssignSchema = z.object({
  assigneeId: z.string().uuid().nullable(),
  version: z.number().int().nonnegative(),
});

export const POST = withAuth(
  async (user, req: NextRequest) => {
    const workItemId = new URL(req.url).searchParams.get("workItemId");
    if (!workItemId) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "workItemId is required.");
    }
    const body = AssignSchema.parse(await jsonBody(req));
    return await assignWorkItem(user, workItemId, {
      assigneeId: body.assigneeId,
      expectedVersion: body.version,
    });
  },
  { csrf: true },
);
