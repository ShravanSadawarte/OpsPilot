"use server";

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { validateQuery, PaginationSchema } from "@/lib/validation";
import { listActivity } from "@/server/services/workItem.service";

export const GET = withAuth(async (user, req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const workItemId = searchParams.get("workItemId");
  if (!workItemId) return NextResponse.json({ error: "workItemId required" }, { status: 400 });
  const pagination = validateQuery(PaginationSchema, req.nextUrl.searchParams);
  const result = await listActivity({
    user,
    workItemId,
    pagination: { page: pagination.page, pageSize: pagination.pageSize },
  });
  return NextResponse.json(result, { status: 200 });
});
