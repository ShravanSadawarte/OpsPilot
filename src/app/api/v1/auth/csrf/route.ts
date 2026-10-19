"use server";

import { NextRequest, NextResponse } from "next/server";
import { csrfToken } from "@/server/services/auth.service";

export const GET = async (req: NextRequest): Promise<NextResponse> => {
  const result = await csrfToken();
  return NextResponse.json(result, { status: 200 });
};
