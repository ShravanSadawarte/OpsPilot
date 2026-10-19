"use server";

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { logout } from "@/server/services/auth.service";

export const POST = withAuth(
  async () => {
    const result = await logout();
    return NextResponse.json(result, { status: 200 });
  },
  { csrf: true },
);
