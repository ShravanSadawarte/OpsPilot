"use server";

import { NextRequest, NextResponse } from "next/server";
import { withAuth, jsonBody } from "@/lib/api-handler";
import {
  getWorkItem,
  updateWorkItem,
  transitionWorkItem,
} from "@/server/services/workItem.service";
import { UpdateWorkItemSchema } from "@/lib/validation";
import { z } from "zod";

const transitionSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "RESOLVED", "CLOSED"]),
  version: z.number().int().nonnegative(),
});

export const GET = withAuth(async (_user, req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const workItemId = searchParams.get("workItemId");
  if (!workItemId) return NextResponse.json({ error: "workItemId required" }, { status: 400 });
  const result = await getWorkItem(_user, workItemId);
  return NextResponse.json(result, { status: 200 });
});

export const PATCH = withAuth(
  async (user, req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const workItemId = searchParams.get("workItemId");
    if (!workItemId) return NextResponse.json({ error: "workItemId required" }, { status: 400 });
    const body = UpdateWorkItemSchema.parse(await jsonBody(req));
    const result = await updateWorkItem(user, workItemId, body);
    return NextResponse.json(result, { status: 200 });
  },
  { csrf: true },
);

export const POST = withAuth(
  async (user, req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const workItemId = searchParams.get("workItemId");
    if (!workItemId) return NextResponse.json({ error: "workItemId required" }, { status: 400 });
    const body = transitionSchema.parse(await jsonBody(req));
    const result = await transitionWorkItem(user, workItemId, body);
    return NextResponse.json(result, { status: 200 });
  },
  { csrf: true },
);
