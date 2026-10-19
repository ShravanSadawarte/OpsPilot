"use server";

import { NextRequest } from "next/server";
import { withAuth, jsonBody } from "@/lib/api-handler";
import { AppError, ErrorCode } from "@/lib/http";
import { getApproval, decideApproval } from "@/server/services/approval.service";
import { z } from "zod";

const DecideSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().max(1000).optional(),
});

export const GET = withAuth(async (user, req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const approvalId = searchParams.get("approvalId");
  if (!approvalId) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, "approvalId is required.");
  }
  return await getApproval(user, approvalId);
});

export const POST = withAuth(
  async (user, req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const approvalId = searchParams.get("approvalId");
    if (!approvalId) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, "approvalId is required.");
    }
    const body = DecideSchema.parse(await jsonBody(req));
    return await decideApproval(user, approvalId, {
      status: body.status,
      reason: body.reason,
    });
  },
  { csrf: true },
);
