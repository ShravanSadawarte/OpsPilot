"use server";

import { NextRequest } from "next/server";
import { withAuth, jsonBody } from "@/lib/api-handler";
import { AppError, ErrorCode } from "@/lib/http";
import { claimWorkItem } from "@/server/services/workItem.service";
import { z } from "zod";

const ClaimSchema = z.object({
  version: z.number().int().nonnegative(),
});

export const POST = withAuth(
  async (user, req: NextRequest) => {
    const workItemId = new URL(req.url).searchParams.get("workItemId");
    if (!workItemId) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "workItemId is required.");
    }
    const body = ClaimSchema.parse(await jsonBody(req));
    return await claimWorkItem(user, workItemId, body.version);
  },
  { csrf: true },
);
