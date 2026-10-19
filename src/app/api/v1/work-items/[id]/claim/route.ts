"use server";

import { NextRequest, NextResponse } from "next/server";
import { withAuth, jsonBody } from "@/lib/api-handler";
import { claimWorkItem } from "@/server/services/workItem.service";
import { z } from "zod";

const ClaimSchema = z.object({
  version: z.number().int().nonnegative(),
});

export const POST = withAuth(
  async (user, req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const workItemId = searchParams.get("workItemId");
    if (!workItemId) return NextResponse.json({ error: "workItemId required" }, { status: 400 });
    const body = ClaimSchema.parse(await jsonBody(req));
    const result = await claimWorkItem(user, workItemId, body.version);
    return NextResponse.json(result, { status: 200 });
  },
  { csrf: true },
);
