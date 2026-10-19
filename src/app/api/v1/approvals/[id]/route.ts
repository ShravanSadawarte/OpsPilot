"use server";

import { NextRequest, NextResponse } from "next/server";
import { withAuth, jsonBody } from "@/lib/api-handler";
import { getApproval, decideApproval } from "@/server/services/approval.service";
import { z } from "zod";

const DecideSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().max(1000).optional(),
});

export const GET = withAuth(async (user, req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const approvalId = searchParams.get("approvalId");
  if (!approvalId) return NextResponse.json({ error: "approvalId required" }, { status: 400 });
  const result = await getApproval(user, approvalId);
  return NextResponse.json(result, { status: 200 });
});

export const POST = withAuth(
  async (user, req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const approvalId = searchParams.get("approvalId");
    if (!approvalId) return NextResponse.json({ error: "approvalId required" }, { status: 400 });
    const body = DecideSchema.parse(await jsonBody(req));
    const result = await decideApproval(user, approvalId, {
      status: body.status,
      reason: body.reason,
    });
    return NextResponse.json(result, { status: 200 });
  },
  { csrf: true },
);
