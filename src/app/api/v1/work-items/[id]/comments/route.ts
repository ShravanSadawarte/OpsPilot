"use server";

import { NextRequest, NextResponse } from "next/server";
import { withAuth, jsonBody } from "@/lib/api-handler";
import { validateQuery, PaginationSchema } from "@/lib/validation";
import { addComment, listActivity } from "@/server/services/workItem.service";
import { z } from "zod";

const CommentSchema = z.object({ body: z.string().min(1).max(5000) });

export const GET = withAuth(async (_user, req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const workItemId = searchParams.get("workItemId");
  if (!workItemId) return NextResponse.json({ error: "workItemId required" }, { status: 400 });
  const pagination = validateQuery(PaginationSchema, req.nextUrl.searchParams);
  const result = await listActivity({
    user: _user,
    workItemId,
    pagination: { page: pagination.page, pageSize: pagination.pageSize },
  });
  return NextResponse.json(result, { status: 200 });
});

export const POST = withAuth(
  async (user, req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const workItemId = searchParams.get("workItemId");
    if (!workItemId) return NextResponse.json({ error: "workItemId required" }, { status: 400 });
    const body = CommentSchema.parse(await jsonBody(req));
    const result = await addComment(user, workItemId, { body: body.body });
    return NextResponse.json(result, { status: 201 });
  },
  { csrf: true },
);
