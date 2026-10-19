"use server";

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { dashboardMetrics } from "@/server/services/dashboard.service";

export const GET = withAuth(async (user) => {
  const result = await dashboardMetrics(user);
  return NextResponse.json(result, { status: 200 });
});
