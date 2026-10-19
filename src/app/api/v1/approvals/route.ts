"use server";

import { NextRequest, NextResponse } from "next/server";
import { withAuth, jsonBody } from "@/lib/api-handler";
import {
  requestApproval,
  listPendingApprovals,
} from "@/server/services/approval.service";
import { z } from "zod";

const RequestSchema = z.object({ workItemId: z.string().uuid() });

export const GET = withAuth(async (user) => {
  const result = await listPendingApprovals(user);
  return NextResponse.json(result, { status: 200 });
});

export const POST = withAuth(
  async (user, req: NextRequest) => {
    const body = RequestSchema.parse(await jsonBody(req));
    const result = await requestApproval(user, { workItemId: body.workItemId });
    return NextResponse.json(result, { status: 201 });
  },
  { csrf: true },
);
