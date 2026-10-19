"use server";

import { NextRequest, NextResponse } from "next/server";
import { withAuth, jsonBody } from "@/lib/api-handler";
import { assignWorkItem } from "@/server/services/workItem.service";
import { z } from "zod";

const AssignSchema = z.object({
  assigneeId: z.string().uuid().nullable(),
  version: z.number().int().nonnegative(),
});

export const POST = withAuth(
  async (user, req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const workItemId = searchParams.get("workItemId");
    if (!workItemId) return NextResponse.json({ error: "workItemId required" }, { status: 400 });
    const body = AssignSchema.parse(await jsonBody(req));
    const result = await assignWorkItem(user, workItemId, {
      assigneeId: body.assigneeId,
      expectedVersion: body.version,
    });
    return NextResponse.json(result, { status: 200 });
  },
  { csrf: true },
);
