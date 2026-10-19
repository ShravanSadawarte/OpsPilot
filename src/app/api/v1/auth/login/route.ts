"use server";

import { NextRequest, NextResponse } from "next/server";
import { AppError, ErrorCode, err, internalError, requestId } from "@/lib/http";
import { login } from "@/server/services/auth.service";
import type { LoginInput } from "@/server/services/auth.service";

async function jsonBody<T = unknown>(req: NextRequest): Promise<T> {
  const text = await req.text();
  if (!text) throw new AppError(400, ErrorCode.VALIDATION_ERROR, "Request body is required.");
  return JSON.parse(text) as T;
}

export const POST = async (req: NextRequest): Promise<NextResponse> => {
  const rid = requestId(req.headers);
  try {
    const body = await jsonBody<LoginInput>(req);
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : null;
    const result = await login(body, {
      ip,
      csrfHeaderToken: req.headers.get("x-csrf-token"),
    });
    return NextResponse.json(result, { status: 200, headers: { "x-request-id": rid } });
  } catch (e: unknown) {
    return errorResponse(e, rid);
  }
};

function errorResponse(e: unknown, rid: string): NextResponse {
  if (e instanceof AppError) {
    return err(e, { requestId: rid });
  }
  return internalError((e as Error)?.message ?? "Internal server error", { requestId: rid });
}
