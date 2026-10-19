"use server";

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { me } from "@/server/services/auth.service";

export const GET = withAuth(async (user) => {
  const result = await me();
  return NextResponse.json(result, { status: 200 });
});
